import { useRef, useEffect } from "react";
import type { ModelStatus, ChatMessage, ModelOption } from "../../hooks/useWebLLM";
import { ModelSelector } from "../common/ModelSelector";
import { ProgressBar } from "../common/ProgressBar";
import { MessageBubble } from "../common/MessageBubble";
import "./LLMChat.css";

interface LLMChatProps {
  status: ModelStatus;
  loadProgress: number;
  error: string | null;
  activeModel: string | null;
  selectedModel: string;
  availableModels: ModelOption[];
  chatHistory: ChatMessage[];
  streamingText: string;
  onSelectModel: (modelId: string) => void;
  onLoadModel: () => void;
  onUnloadModel: () => void;
  onClearCache: () => void;
}

export function LLMChat({
  status,
  loadProgress,
  error,
  activeModel,
  selectedModel,
  availableModels,
  chatHistory,
  streamingText,
  onSelectModel,
  onLoadModel,
  onUnloadModel,
  onClearCache,
}: LLMChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingText]);

  const buttonLabel = () => {
    if (status === "ready" && activeModel !== selectedModel) return "Switch Model";
    if (status === "ready") return "Reload";
    if (status === "error") return "Retry";
    return "Load Model";
  };

  return (
    <div className="panel">
      <div className="model-controls">
        <ModelSelector
          value={selectedModel}
          models={availableModels}
          onChange={onSelectModel}
          disabled={status === "loading" || status === "generating"}
        />

        {(status === "idle" || status === "ready" || status === "error") && (
          <button className="btn primary" onClick={onLoadModel}>
            {buttonLabel()}
          </button>
        )}

        {status === "loading" && (
          <ProgressBar progress={loadProgress} label={`Loading model... ${loadProgress}%`} />
        )}
        {status === "ready" && (
          <>
            <span className="status-badge ready">
              {availableModels.find((m) => m.id === activeModel)?.label ?? "Model"} Ready
            </span>
            <button className="btn danger" onClick={onUnloadModel}>
              Unload
            </button>
          </>
        )}
        {status === "generating" && (
          <span className="status-badge generating">Generating...</span>
        )}
        {status === "error" && (
          <span className="error">{error}</span>
        )}

        {(status === "idle" || status === "ready" || status === "error") && (
          <button className="btn cache-btn" onClick={onClearCache} title="Delete all cached model weights from disk">
            Clear Cache
          </button>
        )}
      </div>

      <div className="messages">
        {chatHistory.map((msg, i) => (
          <MessageBubble key={i} className={msg.role} label={msg.role === "user" ? "You:" : "LLM:"}>
            <p>{msg.content}</p>
          </MessageBubble>
        ))}
        {status === "generating" && !streamingText && (
          <MessageBubble className="assistant" label="LLM:">
            <p className="thinking">Thinking<span className="dots" /></p>
          </MessageBubble>
        )}
        {streamingText && (
          <MessageBubble className="assistant" label="LLM:">
            <p>{streamingText}</p>
          </MessageBubble>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
