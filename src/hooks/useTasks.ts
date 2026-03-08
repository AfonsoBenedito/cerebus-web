import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "cerebus-tasks";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  title: string;
  description: string;
  agentId: string;
  status: TaskStatus;
  result?: string;
  createdAt: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function persistTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);

  useEffect(() => {
    persistTasks(tasks);
  }, [tasks]);

  const createTask = useCallback((title: string, description: string, agentId: string): Task => {
    const task: Task = {
      id: generateId(),
      title,
      description,
      agentId,
      status: "pending",
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    return task;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, "id" | "createdAt">>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    tasks,
    createTask,
    updateTask,
    deleteTask,
  };
}
