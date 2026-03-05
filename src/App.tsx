import { useState, useEffect } from "react";
import { useWebLLM, AVAILABLE_MODELS } from "./hooks/useWebLLM";
import type { ChatMessage } from "./hooks/useWebLLM";
import { usePeer } from "./hooks/usePeer";
import type { PeerMessage } from "./hooks/usePeer";
import { Header } from "./components/Layout/Header";
import { TabBar } from "./components/Layout/TabBar";
import type { Tab } from "./components/Layout/TabBar";
import { ChatInput } from "./components/Layout/ChatInput";
import { LLMChat } from "./components/LLMChat/LLMChat";
import { PeerChat } from "./components/PeerChat/PeerChat";
import { PendingBanner } from "./components/PeerChat/PendingBanner";
import "./App.css";

function App() {
  const { status, loadProgress, error, activeModel, loadModel, generate } = useWebLLM();
  const {
    peerId,
    connected,
    messages: peerMessages,
    initialize,
    connectToPeer,
    sendMessage,
    disconnect,
  } = usePeer();

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[1].id);
  const [remotePeerId, setRemotePeerId] = useState("");
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("llm");
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);

  // --- LLM handlers ---

  const handleSendLLM = async () => {
    if (!input.trim() || status === "generating") return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setInput("");
    setStreamingText("");

    try {
      const reply = await generate(newHistory, (chunk) => {
        setStreamingText(chunk);
      });
      setChatHistory([...newHistory, { role: "assistant", content: reply }]);
      setStreamingText("");
    } catch {
      // error is handled by the hook
    }
  };

  // --- Peer handlers ---

  const handleSendPeer = () => {
    if (!input.trim() || !connected) return;

    const trimmed = input.trim();
    const isAgent = trimmed.startsWith("/agent ");
    const msg: PeerMessage = {
      type: isAgent ? "llm-request" : "chat",
      payload: isAgent ? trimmed.slice(7) : trimmed,
      sender: peerId || "unknown",
      timestamp: Date.now(),
    };
    sendMessage(msg);
    setInput("");
  };

  const handleConnect = () => {
    const target = remotePeerId.trim();
    if (!target) return;
    if (target === peerId) {
      alert("You can't connect to yourself.");
      return;
    }
    connectToPeer(target);
    setRemotePeerId("");
  };

  const handleJoin = () => {
    if (username.trim()) initialize(username.trim());
  };

  // --- Agent request handling ---

  const handleRequestLLM = async (prompt: string) => {
    if (status !== "ready") return;

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const reply = await generate(messages);

    const responseMsg: PeerMessage = {
      type: "llm-response",
      payload: reply,
      sender: peerId || "unknown",
      timestamp: Date.now(),
    };
    sendMessage(responseMsg);
  };

  useEffect(() => {
    const lastMsg = peerMessages[peerMessages.length - 1];
    if (lastMsg?.type === "llm-request" && lastMsg.sender !== peerId) {
      if (status === "ready") {
        handleRequestLLM(lastMsg.payload);
      } else {
        setPendingRequest(lastMsg.payload);
        sendMessage({
          type: "llm-loading",
          payload: "Choosing a model...",
          sender: peerId || "unknown",
          timestamp: Date.now(),
        });
      }
    }
  }, [peerMessages.length]);

  useEffect(() => {
    if (status === "ready" && pendingRequest) {
      handleRequestLLM(pendingRequest);
      setPendingRequest(null);
    }
  }, [status, pendingRequest]);

  // --- Derived state ---

  const showPendingBanner = pendingRequest && (status !== "ready");
  const inputDisabled = activeTab === "llm"
    ? status !== "ready" && status !== "generating"
    : !connected;
  const sendDisabled = activeTab === "llm"
    ? status !== "ready" || !input.trim()
    : !connected || !input.trim();

  return (
    <div className="app">
      <Header />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} peerConnected={connected} />

      <main className="main">
        {activeTab === "llm" && (
          <LLMChat
            status={status}
            loadProgress={loadProgress}
            error={error}
            activeModel={activeModel}
            selectedModel={selectedModel}
            chatHistory={chatHistory}
            streamingText={streamingText}
            onSelectModel={setSelectedModel}
            onLoadModel={() => loadModel(selectedModel)}
          />
        )}

        {activeTab === "peer" && (
          <PeerChat
            peerId={peerId}
            messages={peerMessages}
            username={username}
            remotePeerId={remotePeerId}
            onUsernameChange={setUsername}
            onRemotePeerIdChange={setRemotePeerId}
            onJoin={handleJoin}
            onConnect={handleConnect}
            onDisconnect={disconnect}
          />
        )}
      </main>

      {showPendingBanner && (
        <PendingBanner
          selectedModel={selectedModel}
          loadProgress={loadProgress}
          isLoading={status === "loading"}
          onSelectModel={setSelectedModel}
          onLoadModel={() => loadModel(selectedModel)}
          onDismiss={() => setPendingRequest(null)}
        />
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={activeTab === "llm" ? handleSendLLM : handleSendPeer}
        placeholder={activeTab === "llm" ? "Ask the local LLM..." : "Send a message to peers..."}
        disabled={inputDisabled}
        sendDisabled={sendDisabled}
      />
    </div>
  );
}

export default App;
