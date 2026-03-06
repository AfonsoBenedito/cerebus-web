import type { ModelOption } from "../../hooks/useWebLLM";
import { ModelSelector } from "../common/ModelSelector";
import { ProgressBar } from "../common/ProgressBar";
import "./PendingBanner.css";

interface PendingBannerProps {
  selectedModel: string;
  availableModels: ModelOption[];
  loadProgress: number;
  isLoading: boolean;
  onSelectModel: (modelId: string) => void;
  onLoadModel: () => void;
  onDismiss: () => void;
}

export function PendingBanner({
  selectedModel,
  availableModels,
  loadProgress,
  isLoading,
  onSelectModel,
  onLoadModel,
  onDismiss,
}: PendingBannerProps) {
  if (isLoading) {
    return (
      <div className="pending-banner">
        <p>Loading model to respond to agent request...</p>
        <ProgressBar progress={loadProgress} />
      </div>
    );
  }

  return (
    <div className="pending-banner">
      <p>A peer sent an agent request. Load a model to respond.</p>
      <div className="pending-actions">
        <ModelSelector value={selectedModel} models={availableModels} onChange={onSelectModel} />
        <button className="btn primary" onClick={onLoadModel}>
          Load Model
        </button>
        <button className="btn" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
