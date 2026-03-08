import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "cerebus-agents";

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  autonomous: boolean;
  createdAt: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

function loadAgents(): Agent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function persistAgents(agents: Agent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>(loadAgents);

  useEffect(() => {
    persistAgents(agents);
  }, [agents]);

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

  const saveToFile = useCallback(async (agent: Agent) => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${agent.name.toLowerCase().replace(/\s+/g, "-")}.cerebus.json`,
        types: [
          {
            description: "Cerebus Agent",
            accept: { "application/json": [".cerebus.json", ".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(agent, null, 2));
      await writable.close();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      throw err;
    }
  }, []);

  const loadFromFile = useCallback(async (): Promise<Agent | null> => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Cerebus Agent",
            accept: { "application/json": [".cerebus.json", ".json"] },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate required fields
      if (!data.name || !data.systemPrompt) {
        throw new Error("Invalid agent file: missing name or systemPrompt");
      }

      const agent: Agent = {
        id: generateId(),
        name: data.name,
        systemPrompt: data.systemPrompt,
        autonomous: data.autonomous ?? false,
        createdAt: Date.now(),
      };
      setAgents((prev) => [...prev, agent]);
      return agent;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return null;
      throw err;
    }
  }, []);

  return {
    agents,
    createAgent,
    updateAgent,
    deleteAgent,
    saveToFile,
    loadFromFile,
  };
}
