import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "./useWebLLM";
import { buildToolDescriptions, executeTool } from "./agentTools";
import type { ToolContext } from "./agentTools";

const STORAGE_KEY = "cerebus-agent-config";
const MAX_REASONING_STEPS = 15;

export interface AgentConfig {
  systemPrompt: string;
  name: string;
  autonomous: boolean;
}

export interface AgentStep {
  type: "thinking" | "answer" | "tool_call" | "tool_result";
  content: string;
}

const AUTONOMOUS_INSTRUCTIONS = `

When given a task, you must respond using this exact format:

If you need to think through steps before answering:
[THINKING] your reasoning here

To use a tool:
[TOOL_CALL] tool_name: arguments

When you have the final answer:
[ANSWER] your final answer here

Available tools:
${buildToolDescriptions()}

Rules:
- Each response must contain exactly ONE block ([THINKING], [TOOL_CALL], or [ANSWER]).
- After a tool call, you will receive the result in a [TOOL_RESULT] message. Use it to continue reasoning.
- You MUST always end with an [ANSWER] block.
- You can have multiple [THINKING] and [TOOL_CALL] blocks before the final [ANSWER].`;

const DEFAULT_CONFIG: AgentConfig = {
  systemPrompt: "You are a helpful assistant. Be concise and direct.",
  name: "Agent",
  autonomous: false,
};

function loadConfig(): AgentConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: AgentConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function parseStep(response: string): AgentStep {
  const trimmed = response.trim();

  if (trimmed.startsWith("[ANSWER]")) {
    return { type: "answer", content: trimmed.slice(8).trim() };
  }
  if (trimmed.startsWith("[THINKING]")) {
    return { type: "thinking", content: trimmed.slice(10).trim() };
  }
  if (trimmed.startsWith("[TOOL_CALL]")) {
    return { type: "tool_call", content: trimmed.slice(11).trim() };
  }
  // If no tag, treat as final answer
  return { type: "answer", content: trimmed };
}

function parseToolCall(content: string): { name: string; args: string } | null {
  // Expected format: "tool_name: arguments"
  const colonIdx = content.indexOf(":");
  if (colonIdx === -1) {
    return { name: content.trim(), args: "" };
  }
  return {
    name: content.slice(0, colonIdx).trim(),
    args: content.slice(colonIdx + 1).trim(),
  };
}

export function useAgent() {
  const [config, setConfig] = useState<AgentConfig>(loadConfig);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isReasoning, setIsReasoning] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);

  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      saveConfig(next);
      return next;
    });
  }, []);

  const buildMessages = useCallback(
    (userMessage: string): ChatMessage[] => {
      const systemContent = config.autonomous
        ? config.systemPrompt + AUTONOMOUS_INSTRUCTIONS
        : config.systemPrompt;

      const systemMsg: ChatMessage = {
        role: "system",
        content: systemContent,
      };

      historyRef.current.push({ role: "user", content: userMessage });

      return [systemMsg, ...historyRef.current];
    },
    [config.systemPrompt, config.autonomous]
  );

  const addAssistantMessage = useCallback((content: string) => {
    historyRef.current.push({ role: "assistant", content });
  }, []);

  const runAutonomous = useCallback(
    async (
      prompt: string,
      generate: (messages: ChatMessage[]) => Promise<string>,
      onStep?: (step: AgentStep, allSteps: AgentStep[]) => void,
      toolContext?: ToolContext
    ): Promise<string> => {
      setIsReasoning(true);
      setSteps([]);

      const systemContent = config.systemPrompt + AUTONOMOUS_INSTRUCTIONS;
      const systemMsg: ChatMessage = { role: "system", content: systemContent };

      historyRef.current.push({ role: "user", content: prompt });
      const accumulatedSteps: AgentStep[] = [];

      const pushStep = (step: AgentStep) => {
        accumulatedSteps.push(step);
        setSteps([...accumulatedSteps]);
        onStep?.(step, accumulatedSteps);
      };

      for (let i = 0; i < MAX_REASONING_STEPS; i++) {
        const messages: ChatMessage[] = [systemMsg, ...historyRef.current];
        const response = await generate(messages);
        const step = parseStep(response);

        pushStep(step);
        historyRef.current.push({ role: "assistant", content: response });

        if (step.type === "answer") {
          setIsReasoning(false);
          return step.content;
        }

        if (step.type === "tool_call") {
          const parsed = parseToolCall(step.content);
          let result: string;
          if (parsed) {
            result = await executeTool(parsed.name, parsed.args, toolContext ?? {});
          } else {
            result = "Error: Could not parse tool call.";
          }

          const resultStep: AgentStep = { type: "tool_result", content: result };
          pushStep(resultStep);

          // Feed tool result back as a user message
          historyRef.current.push({
            role: "user",
            content: `[TOOL_RESULT] ${result}\n\nContinue. Use [THINKING] to reason about the result, [TOOL_CALL] to use another tool, or [ANSWER] for the final response.`,
          });
          continue;
        }

        // Thinking step — prompt to continue
        historyRef.current.push({
          role: "user",
          content: "Continue. Use [THINKING] for more reasoning, [TOOL_CALL] to use a tool, or [ANSWER] for the final response.",
        });
      }

      // Max steps reached
      setIsReasoning(false);
      const lastStep = accumulatedSteps[accumulatedSteps.length - 1];
      return lastStep?.content ?? "I was unable to reach a conclusion.";
    },
    [config.systemPrompt]
  );

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setSteps([]);
  }, []);

  return {
    config,
    steps,
    isReasoning,
    updateConfig,
    buildMessages,
    addAssistantMessage,
    runAutonomous,
    clearHistory,
    history: historyRef,
  };
}
