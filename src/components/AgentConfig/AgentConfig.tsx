import { useState } from "react";
import "./AgentConfig.css";

interface AgentConfigProps {
  name: string;
  systemPrompt: string;
  autonomous: boolean;
  historyLength: number;
  onUpdate: (updates: { name?: string; systemPrompt?: string; autonomous?: boolean }) => void;
  onClearHistory: () => void;
}

export function AgentConfig({
  name,
  systemPrompt,
  autonomous,
  historyLength,
  onUpdate,
  onClearHistory,
}: AgentConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftPrompt, setDraftPrompt] = useState(systemPrompt);

  const handleSave = () => {
    onUpdate({ name: draftName, systemPrompt: draftPrompt });
    setIsOpen(false);
  };

  const handleCancel = () => {
    setDraftName(name);
    setDraftPrompt(systemPrompt);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <>
        <div className="agent-config-bar">
          <span className="agent-name">{name}</span>
          {autonomous && <span className="agent-badge">Autonomous</span>}
          <span className="agent-history">{historyLength} messages in memory</span>
          <button className="btn" onClick={() => setIsOpen(true)}>
            Configure
          </button>
          {historyLength > 0 && (
            <button className="btn" onClick={onClearHistory}>
              Clear Memory
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="agent-config-panel">
      <div className="agent-config-field">
        <label>Agent Name</label>
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Agent"
        />
      </div>
      <div className="agent-config-field">
        <label>System Prompt</label>
        <textarea
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          placeholder="Define how the agent should behave..."
          rows={4}
        />
      </div>
      <div className="agent-config-field agent-config-toggle">
        <label htmlFor="autonomous-toggle">Autonomous Mode</label>
        <input
          id="autonomous-toggle"
          type="checkbox"
          checked={autonomous}
          onChange={(e) => onUpdate({ autonomous: e.target.checked })}
        />
        <span className="agent-toggle-hint">
          Agent will reason through multiple steps before answering
        </span>
      </div>
      <div className="agent-config-actions">
        <button className="btn primary" onClick={handleSave}>
          Save
        </button>
        <button className="btn" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
