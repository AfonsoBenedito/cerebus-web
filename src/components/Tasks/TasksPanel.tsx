import { useState } from "react";
import type { Agent } from "../../hooks/useAgents";
import type { Task, TaskStatus } from "../../hooks/useTasks";
import type { ModelOption, ModelStatus } from "../../hooks/useWebLLM";
import "./TasksPanel.css";

interface TasksPanelProps {
  tasks: Task[];
  agents: Agent[];
  availableModels: ModelOption[];
  selectedModel: string;
  modelStatus: ModelStatus;
  loadProgress: number;
  activeModel: string | null;
  runningTaskId: string | null;
  streamingResult: string;
  onCreate: (title: string, description: string, agentId: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Task, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onSelectModel: (modelId: string) => void;
  onRunTask: (taskId: string) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export function TasksPanel({
  tasks,
  agents,
  availableModels,
  selectedModel,
  modelStatus,
  loadProgress,
  activeModel,
  runningTaskId,
  streamingResult,
  onCreate,
  onUpdate,
  onDelete,
  onSelectModel,
  onRunTask,
}: TasksPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAgentId("");
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim() || !agentId) return;
    onCreate(title.trim(), description.trim(), agentId);
    resetForm();
  };

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? "Unknown";

  const sortedTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  const isModelReady = modelStatus === "ready";
  const isBusy = runningTaskId !== null;

  return (
    <div className="tasks-panel">
      <div className="tasks-header">
        <h2>Tasks</h2>
        <button
          className="btn primary"
          onClick={() => { resetForm(); setShowForm(true); }}
          disabled={agents.length === 0}
          title={agents.length === 0 ? "Create an agent first" : undefined}
        >
          New Task
        </button>
      </div>

      {/* Model selector bar */}
      <div className="tasks-model-bar">
        <label>Model</label>
        <select
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value)}
          disabled={modelStatus === "loading" || modelStatus === "generating"}
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.size})
            </option>
          ))}
        </select>
        {isModelReady && activeModel && (
          <span className="tasks-model-status ready">
            {availableModels.find((m) => m.id === activeModel)?.label ?? activeModel} loaded
          </span>
        )}
        {modelStatus === "loading" && (
          <span className="tasks-model-status loading">
            Loading... {loadProgress}%
          </span>
        )}
        {modelStatus === "generating" && (
          <span className="tasks-model-status loading">
            Generating...
          </span>
        )}
        {modelStatus === "idle" && (
          <span className="tasks-model-status idle">
            Model will auto-load when you run a task
          </span>
        )}
      </div>

      {showForm && (
        <div className="task-form">
          <div className="task-form-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Review login flow"
            />
          </div>
          <div className="task-form-field">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the agent should do..."
              rows={4}
            />
          </div>
          <div className="task-form-field">
            <label>Assign to Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Select an agent...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="task-form-actions">
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || !agentId}
            >
              Create Task
            </button>
            <button className="btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {agents.length === 0 && !showForm && (
        <div className="tasks-empty">
          <p>Create an agent first, then you can assign tasks to it.</p>
        </div>
      )}

      {agents.length > 0 && tasks.length === 0 && !showForm && (
        <div className="tasks-empty">
          <p>No tasks yet. Create one to get started.</p>
        </div>
      )}

      <div className="tasks-list">
        {sortedTasks.map((task) => {
          const isRunning = runningTaskId === task.id;
          return (
            <div key={task.id} className={`task-card task-status-${isRunning ? "running" : task.status}`}>
              <div className="task-card-header">
                <span className="task-card-title">{task.title}</span>
                <span className={`task-card-status status-${isRunning ? "running" : task.status}`}>
                  {isRunning ? "Running" : STATUS_LABELS[task.status]}
                </span>
              </div>
              <p className="task-card-description">{task.description}</p>
              <div className="task-card-meta">
                <span className="task-card-agent">Agent: {agentName(task.agentId)}</span>
              </div>

              {/* Streaming output while running */}
              {isRunning && streamingResult && (
                <div className="task-card-result streaming">
                  <label>Output (streaming)</label>
                  <p>{streamingResult}</p>
                </div>
              )}
              {isRunning && modelStatus === "loading" && (
                <div className="task-card-progress">
                  <div className="task-card-progress-bar" style={{ width: `${loadProgress}%` }} />
                  <span>Loading model... {loadProgress}%</span>
                </div>
              )}

              {/* Final result */}
              {!isRunning && task.result && (
                <div className="task-card-result">
                  <label>Result</label>
                  <p>{task.result}</p>
                </div>
              )}

              <div className="task-card-actions">
                {task.status === "pending" && (
                  <button
                    className="btn primary"
                    onClick={() => onRunTask(task.id)}
                    disabled={isBusy}
                    title={isBusy ? "Another task is running" : undefined}
                  >
                    Run
                  </button>
                )}
                {task.status === "completed" && (
                  <button
                    className="btn"
                    onClick={() => onUpdate(task.id, { status: "pending", result: undefined })}
                  >
                    Re-run
                  </button>
                )}
                {task.status === "failed" && (
                  <button
                    className="btn"
                    onClick={() => onRunTask(task.id)}
                    disabled={isBusy}
                  >
                    Retry
                  </button>
                )}
                {!isRunning && (
                  <button className="btn danger" onClick={() => onDelete(task.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
