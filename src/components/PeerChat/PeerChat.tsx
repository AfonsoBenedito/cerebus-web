import { useRef, useEffect } from "react";
import type { PeerMessage } from "../../hooks/usePeer";
import { MessageBubble } from "../common/MessageBubble";
import "./PeerChat.css";

interface PeerChatProps {
  peerId: string | null;
  messages: PeerMessage[];
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
                onKeyDown={(e) => e.key === "Enter" && onConnect()}
              />
              <button className="btn" onClick={onConnect}>
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
        {messages.filter((msg) => msg.type !== "llm-loading").map((msg, i) => {
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
          const last = messages[messages.length - 1];
          if (last?.type === "llm-loading" && last.sender !== peerId) {
            return (
              <MessageBubble className="agent remote" badge="Agent">
                <p className="thinking">{last.sender} is choosing a model<span className="dots" /></p>
              </MessageBubble>
            );
          }
          if (last?.type === "llm-request" && last.sender === peerId) {
            return (
              <MessageBubble className="agent remote" badge="Agent Response">
                <p className="thinking">Thinking<span className="dots" /></p>
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
