import type { ModelOption } from "../../hooks/useWebLLM";
import "./ModelSelector.css";

interface ModelSelectorProps {
  value: string;
  models: ModelOption[];
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, models, onChange, disabled }: ModelSelectorProps) {
  return (
    <select
      className="model-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} ({m.size})
        </option>
      ))}
    </select>
  );
}
