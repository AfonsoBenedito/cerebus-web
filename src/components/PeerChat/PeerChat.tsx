import { useRef, useEffect } from "react";
import type { PeerMessage } from "../../hooks/usePeer";
import type { AgentStep } from "../../hooks/useAgent";
import { MessageBubble } from "../common/MessageBubble";
import "./PeerChat.css";

interface PeerChatProps {
  peerId: string | null;
  messages: PeerMessage[];
  steps: AgentStep[];
  isReasoning: boolean;
  username: string;
  remotePeerId: string;
  onUsernameChange: (value: string) => void;
  onRemotePeerIdChange: (value: string) => void;
  onJoin: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function PeerChat({
  peerId,
  messages,
  steps,
  isReasoning,
  username,
  remotePeerId,
  onUsernameChange,
  onRemotePeerIdChange,
  onJoin,
  onConnect,
  onDisconnect,
}: PeerChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="panel">
      <div className="peer-controls">
        {!peerId ? (
          <div className="connect-form">
            <input
              type="text"
              placeholder="Choose a username..."
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && username.trim() && onJoin()}
            />
            <button
              className="btn primary"
              onClick={onJoin}
              disabled={!username.trim()}
            >
              Join
            </button>
          </div>
        ) : (
          <>
            <div className="peer-id">
              <label>Logged in as:</label>
              <code>{peerId}</code>
            </div>

            <div className="connect-form">
              <input
                type="text"
                placeholder="Enter username to connect..."
                value={remotePeerId}
                onChange={(e) => onRemotePeerIdChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && remotePeerId.trim() && onConnect()}
              />
              <button className="btn" onClick={onConnect} disabled={!remotePeerId.trim()}>
                Connect
              </button>
              <button className="btn danger" onClick={onDisconnect}>
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>

      <div className="messages">
        {messages.filter((msg) => msg.type !== "llm-loading" && msg.type !== "llm-thinking").map((msg, i) => {
          const isOwn = msg.sender === peerId;
          const isAgent = msg.type === "llm-request" || msg.type === "llm-response";
          const sideClass = isOwn ? "own" : "remote";
          const bubbleClass = msg.type === "system"
            ? "system"
            : isAgent
              ? `agent ${sideClass}`
              : isOwn
                ? "user"
                : "assistant";

          if (msg.type === "system") {
            return (
              <MessageBubble key={i} className={bubbleClass}>
                <em>{msg.payload}</em>
              </MessageBubble>
            );
          }

          const badge = isAgent
            ? msg.type === "llm-request" ? "Agent Request" : "Agent Response"
            : undefined;

          return (
            <MessageBubble
              key={i}
              className={bubbleClass}
              badge={badge}
              label={`${isOwn ? "You" : msg.sender}:`}
            >
              <p>{msg.payload}</p>
            </MessageBubble>
          );
        })}
        {(() => {
          // Find the index of the last request to determine if we're in an active agent cycle
          let lastRequestIdx = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].type === "llm-request") { lastRequestIdx = i; break; }
          }
          if (lastRequestIdx === -1) return null;

          // Check if a response already arrived after the last request
          const hasResponse = messages.slice(lastRequestIdx).some((m) => m.type === "llm-response");
          if (hasResponse) return null;

          const messagesAfterRequest = messages.slice(lastRequestIdx);
          const lastThinking = [...messagesAfterRequest].reverse().find((m) => m.type === "llm-thinking");
          const lastLoading = [...messagesAfterRequest].reverse().find((m) => m.type === "llm-loading");

          // Show model loading status to the requesting user
          if (lastLoading && lastLoading.sender !== peerId) {
            return (
              <MessageBubble className="agent remote" badge="Agent">
                <p className="thinking">{lastLoading.sender} is choosing a model<span className="dots" /></p>
              </MessageBubble>
            );
          }

          // Show thinking status to the requesting user
          if (lastThinking && lastThinking.sender !== peerId) {
            return (
              <MessageBubble className="agent remote" badge="Agent">
                <p className="thinking">{lastThinking.payload}<span className="dots" /></p>
              </MessageBubble>
            );
          }

          // Show agent steps on the agent owner's side while generating
          if (lastThinking && lastThinking.sender === peerId && steps.length > 0) {
            return (
              <MessageBubble className="agent own" badge="Agent">
                <div className="agent-steps">
                  {steps.map((step, i) => (
                    <div key={i} className={`agent-step agent-step--${step.type}`}>
                      <span className="agent-step-label">
                        {step.type === "thinking" && "Thinking"}
                        {step.type === "answer" && "Answer"}
                        {step.type === "tool_call" && "Tool Call"}
                        {step.type === "tool_result" && "Result"}
                      </span>
                      <span className="agent-step-content">{step.content}</span>
                    </div>
                  ))}
                  {isReasoning && (
                    <div className="agent-step agent-step--thinking">
                      <span className="agent-step-label">Thinking</span>
                      <span className="agent-step-content agent-step-dots">...</span>
                    </div>
                  )}
                </div>
              </MessageBubble>
            );
          }

          // Fallback: show simple thinking indicator on the agent owner's side
          if (lastThinking && lastThinking.sender === peerId) {
            return (
              <MessageBubble className="agent own" badge="Agent">
                <p className="thinking">{lastThinking.payload}<span className="dots" /></p>
              </MessageBubble>
            );
          }

          // Show "waiting" on the requesting user's side
          const lastRequest = messages[lastRequestIdx];
          if (lastRequest.sender === peerId) {
            return (
              <MessageBubble className="agent remote" badge="Agent">
                <p className="thinking">Waiting for response<span className="dots" /></p>
              </MessageBubble>
            );
          }

          return null;
        })()}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
