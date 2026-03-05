import { AVAILABLE_MODELS } from "../../hooks/useWebLLM";
import "./ModelSelector.css";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <select
      className="model-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {AVAILABLE_MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} ({m.size})
        </option>
      ))}
    </select>
  );
}
