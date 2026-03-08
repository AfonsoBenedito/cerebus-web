import { useState, useEffect, useCallback } from "react";
import { useWebLLM, useGPUMemory } from "./hooks/useWebLLM";
import type { ChatMessage } from "./hooks/useWebLLM";
import { usePeer } from "./hooks/usePeer";
import type { PeerMessage } from "./hooks/usePeer";
import { useAgent, runAgentTask } from "./hooks/useAgent";
import type { ToolContext } from "./hooks/agentTools";
import { useAgents } from "./hooks/useAgents";
import { useTasks } from "./hooks/useTasks";
import { Header } from "./components/Layout/Header";
import { TabBar } from "./components/Layout/TabBar";
import type { Tab } from "./components/Layout/TabBar";
import { ChatInput } from "./components/Layout/ChatInput";
import { LLMChat } from "./components/LLMChat/LLMChat";
import { PeerChat } from "./components/PeerChat/PeerChat";
import { PendingBanner } from "./components/PeerChat/PendingBanner";
import { AgentConfig } from "./components/AgentConfig/AgentConfig";
import { AgentsPanel } from "./components/Agents/AgentsPanel";
import { TasksPanel } from "./components/Tasks/TasksPanel";
import "./App.css";

function App() {
  const { status, loadProgress, error, activeModel, loadModel, unloadModel, clearCache, generate } = useWebLLM();
  const {
    peerId,
    connected,
    messages: peerMessages,
    initialize,
    connectToPeer,
    sendMessage,
    disconnect,
  } = usePeer();
  const agent = useAgent();
  const { availableModels } = useGPUMemory();
  const { agents, createAgent, updateAgent, deleteAgent, saveToFile, loadFromFile } = useAgents();
  const { tasks, createTask, updateTask, deleteTask } = useTasks();

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [taskStreamingResult, setTaskStreamingResult] = useState("");

  // Set default model once GPU memory detection completes
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].id);
    }
    // If current selection got filtered out, pick the first available
    if (selectedModel && availableModels.length > 0 && !availableModels.some((m) => m.id === selectedModel)) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);

  // --- Task execution ---

  const handleRunTask = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const taskAgent = agents.find((a) => a.id === task.agentId);
    if (!taskAgent) {
      updateTask(taskId, { status: "failed", result: "Agent not found. It may have been deleted." });
      return;
    }

    setRunningTaskId(taskId);
    setTaskStreamingResult("");
    updateTask(taskId, { status: "running", result: undefined });

    try {
      // Load model if not ready
      if (status !== "ready" && status !== "generating") {
        const modelToLoad = selectedModel || availableModels[0]?.id;
        if (!modelToLoad) {
          throw new Error("No models available. WebGPU may not be supported.");
        }
        await loadModel(modelToLoad);
      }

      // Run the task using the agent's full config (system prompt + autonomous mode)
      const result = await runAgentTask(
        { systemPrompt: taskAgent.systemPrompt, autonomous: taskAgent.autonomous },
        task.description,
        generate,
        {
          onChunk: (chunk) => setTaskStreamingResult(chunk),
          onStep: (step) => {
            if (step.type === "thinking") {
              setTaskStreamingResult((prev) => prev + `\n[Thinking] ${step.content}`);
            } else if (step.type === "tool_call") {
              setTaskStreamingResult((prev) => prev + `\n[Tool] ${step.content}`);
            } else if (step.type === "tool_result") {
              setTaskStreamingResult((prev) => prev + `\n[Result] ${step.content}`);
            }
          },
        }
      );

      updateTask(taskId, { status: "completed", result });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateTask(taskId, { status: "failed", result: `Error: ${errorMsg}` });
    } finally {
      setRunningTaskId(null);
      setTaskStreamingResult("");
    }
  }, [tasks, agents, status, selectedModel, availableModels, loadModel, generate, updateTask]);

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
    const isAgentCmd = trimmed.startsWith("/agent ");
    const msg: PeerMessage = {
      type: isAgentCmd ? "llm-request" : "chat",
      payload: isAgentCmd ? trimmed.slice(7) : trimmed,
      sender: peerId || "unknown",
      timestamp: Date.now(),
    };
    sendMessage(msg);
    setInput("");
  };

  const handleConnect = () => {
    const target = remotePeerId.trim().toUpperCase().replace(/\s+/g, "");
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

    const sender = peerId || "unknown";

    // Notify the peer that the agent is thinking
    sendMessage({
      type: "llm-thinking",
      payload: "Generating response...",
      sender,
      timestamp: Date.now(),
    });

    let reply: string;

    if (agent.config.autonomous) {
      const toolContext: ToolContext = {
        sendPeerMessage: (text) => {
          sendMessage({
            type: "chat",
            payload: text,
            sender,
            timestamp: Date.now(),
          });
        },
      };
      reply = await agent.runAutonomous(
        prompt,
        (msgs) => generate(msgs),
        (step) => {
          // Send step updates to the peer
          sendMessage({
            type: "llm-thinking",
            payload: step.type === "thinking"
              ? `Thinking: ${step.content.slice(0, 100)}${step.content.length > 100 ? "..." : ""}`
              : step.type === "tool_call"
                ? `Using tool: ${step.content}`
                : step.type === "tool_result"
                  ? `Tool result received`
                  : step.content,
            sender,
            timestamp: Date.now(),
          });
        },
        toolContext
      );
    } else {
      const messages = agent.buildMessages(prompt);
      reply = await generate(messages);
      agent.addAssistantMessage(reply);
    }

    const responseMsg: PeerMessage = {
      type: "llm-response",
      payload: reply,
      sender,
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
  const showChatInput = activeTab === "llm" || activeTab === "peer";
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
        {activeTab === "agents" && (
          <AgentsPanel
            agents={agents}
            onCreate={createAgent}
            onUpdate={updateAgent}
            onDelete={deleteAgent}
            onSaveToFile={saveToFile}
            onLoadFromFile={loadFromFile}
          />
        )}

        {activeTab === "tasks" && (
          <TasksPanel
            tasks={tasks}
            agents={agents}
            availableModels={availableModels}
            selectedModel={selectedModel}
            modelStatus={status}
            loadProgress={loadProgress}
            activeModel={activeModel}
            runningTaskId={runningTaskId}
            streamingResult={taskStreamingResult}
            onCreate={createTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onSelectModel={setSelectedModel}
            onRunTask={handleRunTask}
          />
        )}

        {activeTab === "llm" && (
          <LLMChat
            status={status}
            loadProgress={loadProgress}
            error={error}
            activeModel={activeModel}
            selectedModel={selectedModel}
            availableModels={availableModels}
            chatHistory={chatHistory}
            streamingText={streamingText}
            onSelectModel={setSelectedModel}
            onLoadModel={() => loadModel(selectedModel)}
            onUnloadModel={unloadModel}
            onClearCache={async () => {
              unloadModel();
              await clearCache();
            }}
          />
        )}

        {activeTab === "peer" && (
          <>
            <AgentConfig
              name={agent.config.name}
              systemPrompt={agent.config.systemPrompt}
              autonomous={agent.config.autonomous}
              historyLength={agent.history.current.length}
              onUpdate={agent.updateConfig}
              onClearHistory={agent.clearHistory}
            />
            <PeerChat
              peerId={peerId}
              messages={peerMessages}
              steps={agent.steps}
              isReasoning={agent.isReasoning}
              username={username}
              remotePeerId={remotePeerId}
              onUsernameChange={setUsername}
              onRemotePeerIdChange={setRemotePeerId}
              onJoin={handleJoin}
              onConnect={handleConnect}
              onDisconnect={disconnect}
            />
          </>
        )}
      </main>

      {showPendingBanner && (
        <PendingBanner
          selectedModel={selectedModel}
          availableModels={availableModels}
          loadProgress={loadProgress}
          isLoading={status === "loading"}
          onSelectModel={setSelectedModel}
          onLoadModel={() => loadModel(selectedModel)}
          onDismiss={() => setPendingRequest(null)}
        />
      )}

      {showChatInput && (
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={activeTab === "llm" ? handleSendLLM : handleSendPeer}
          placeholder={activeTab === "llm" ? "Ask the local LLM..." : "Send a message to peers..."}
          disabled={inputDisabled}
          sendDisabled={sendDisabled}
        />
      )}
    </div>
  );
}

export default App;
