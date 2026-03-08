import { useState } from "react";
import type { Agent } from "../../hooks/useAgents";
import "./AgentsPanel.css";

interface AgentsPanelProps {
  agents: Agent[];
  onCreate: (name: string, systemPrompt: string, autonomous: boolean) => void;
  onUpdate: (id: string, updates: Partial<Omit<Agent, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onSaveToFile: (agent: Agent) => void;
  onLoadFromFile: () => void;
}

export function AgentsPanel({
  agents,
  onCreate,
  onUpdate,
  onDelete,
  onSaveToFile,
  onLoadFromFile,
}: AgentsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [autonomous, setAutonomous] = useState(false);

  const resetForm = () => {
    setName("");
    setSystemPrompt("");
    setAutonomous(false);
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    if (editingId) {
      onUpdate(editingId, { name: name.trim(), systemPrompt: systemPrompt.trim(), autonomous });
    } else {
      onCreate(name.trim(), systemPrompt.trim(), autonomous);
    }
    resetForm();
  };

  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setName(agent.name);
    setSystemPrompt(agent.systemPrompt);
    setAutonomous(agent.autonomous);
    setShowForm(true);
  };

  return (
    <div className="agents-panel">
      <div className="agents-header">
        <h2>Agents</h2>
        <div className="agents-header-actions">
          <button className="btn" onClick={onLoadFromFile}>
            Import from File
          </button>
          <button className="btn primary" onClick={() => { resetForm(); setShowForm(true); }}>
            New Agent
          </button>
        </div>
      </div>

      {showForm && (
        <div className="agent-form">
          <div className="agent-form-field">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Code Reviewer"
            />
          </div>
          <div className="agent-form-field">
            <label>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe how this agent should behave..."
              rows={6}
            />
          </div>
          <div className="agent-form-field agent-form-toggle">
            <label htmlFor="new-agent-autonomous">Autonomous Mode</label>
            <input
              id="new-agent-autonomous"
              type="checkbox"
              checked={autonomous}
              onChange={(e) => setAutonomous(e.target.checked)}
            />
            <span className="agent-form-hint">
              Multi-step reasoning with tool use
            </span>
          </div>
          <div className="agent-form-actions">
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={!name.trim() || !systemPrompt.trim()}
            >
              {editingId ? "Save Changes" : "Create Agent"}
            </button>
            <button className="btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {agents.length === 0 && !showForm && (
        <div className="agents-empty">
          <p>No agents yet. Create one or import from a file.</p>
        </div>
      )}

      <div className="agents-list">
        {agents.map((agent) => (
          <div key={agent.id} className="agent-card">
            <div className="agent-card-header">
              <span className="agent-card-name">{agent.name}</span>
              {agent.autonomous && <span className="agent-card-badge">Autonomous</span>}
            </div>
            <p className="agent-card-prompt">{agent.systemPrompt}</p>
            <div className="agent-card-actions">
              <button className="btn" onClick={() => handleEdit(agent)}>
                Edit
              </button>
              <button className="btn" onClick={() => onSaveToFile(agent)}>
                Save to File
              </button>
              <button className="btn danger" onClick={() => onDelete(agent.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
