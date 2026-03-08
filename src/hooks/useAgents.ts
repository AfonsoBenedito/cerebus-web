import { useState, useCallback } from "react";
import { generateId } from "../utils/id";

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  autonomous: boolean;
  createdAt: number;
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);

  const createAgent = useCallback((name: string, systemPrompt: string, autonomous: boolean): Agent => {
    const agent: Agent = {
      id: generateId(),
      name,
      systemPrompt,
      autonomous,
      createdAt: Date.now(),
    };
    setAgents((prev) => [...prev, agent]);
    return agent;
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<Omit<Agent, "id" | "createdAt">>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const replaceAll = useCallback((newAgents: Agent[]) => {
    setAgents(newAgents);
  }, []);

  return {
    agents,
    createAgent,
    updateAgent,
    deleteAgent,
    replaceAll,
  };
}
