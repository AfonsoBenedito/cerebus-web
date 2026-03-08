import { useState, useCallback } from "react";
import { generateId } from "../utils/id";

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

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

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

  const replaceAll = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
  }, []);

  return {
    tasks,
    createTask,
    updateTask,
    deleteTask,
    replaceAll,
  };
}
