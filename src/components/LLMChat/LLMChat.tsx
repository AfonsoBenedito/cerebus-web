import { useRef, useEffect } from "react";
import type { ModelStatus, ChatMessage, ModelOption } from "../../hooks/useWebLLM";
import { AVAILABLE_MODELS } from "../../hooks/useWebLLM";
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
  cachedModels: string[];
  chatHistory: ChatMessage[];
  streamingText: string;
  onSelectModel: (modelId: string) => void;
  onLoadModel: () => void;
  onUnloadModel: () => void;
  onDeleteFromCache: (modelId: string) => void;
  onClearAllCache: () => void;
}

export function LLMChat({
  status,
  loadProgress,
  error,
  activeModel,
  selectedModel,
  availableModels,
  cachedModels,
  chatHistory,
  streamingText,
  onSelectModel,
  onLoadModel,
  onUnloadModel,
  onDeleteFromCache,
  onClearAllCache,
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

  const isBusy = status === "loading" || status === "generating";

  return (
    <div className="panel">
      <div className="model-controls">
        <ModelSelector
          value={selectedModel}
          models={availableModels}
          onChange={onSelectModel}
          disabled={isBusy}
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
      </div>

      {/* Cached models section */}
      {cachedModels.length > 0 && (
        <div className="cached-models">
          <div className="cached-models-header">
            <span className="cached-models-title">
              Downloaded Models ({cachedModels.length})
            </span>
            {cachedModels.length > 1 && !isBusy && (
              <button className="btn danger cache-btn" onClick={onClearAllCache}>
                Delete All
              </button>
            )}
          </div>
          <div className="cached-models-list">
            {cachedModels.map((id) => {
              const model = AVAILABLE_MODELS.find((m) => m.id === id);
              const isActive = activeModel === id;
              return (
                <div key={id} className={`cached-model-item ${isActive ? "active" : ""}`}>
                  <span className="cached-model-name">
                    {model?.label ?? id}
                  </span>
                  <span className="cached-model-size">{model?.size ?? ""}</span>
                  {isActive && <span className="cached-model-badge">Loaded</span>}
                  <button
                    className="btn danger cache-btn"
                    onClick={() => onDeleteFromCache(id)}
                    disabled={isBusy}
                    title="Delete from browser cache to free space"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
