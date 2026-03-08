import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "./useWebLLM";
import { buildToolDescriptions, executeTool } from "./agentTools";
import type { ToolContext } from "./agentTools";

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
  return { type: "answer", content: trimmed };
}

function parseToolCall(content: string): { name: string; args: string } | null {
  const colonIdx = content.indexOf(":");
  if (colonIdx === -1) {
    return { name: content.trim(), args: "" };
  }
  return {
    name: content.slice(0, colonIdx).trim(),
    args: content.slice(colonIdx + 1).trim(),
  };
}

/**
 * Standalone runner: executes a task using any agent config.
 * Works for both simple and autonomous modes.
 */
export async function runAgentTask(
  agentConfig: { systemPrompt: string; autonomous: boolean },
  prompt: string,
  generate: (messages: ChatMessage[], onChunk?: (text: string) => void) => Promise<string>,
  options?: {
    onChunk?: (text: string) => void;
    onStep?: (step: AgentStep) => void;
    toolContext?: ToolContext;
  }
): Promise<string> {
  if (!agentConfig.autonomous) {
    const messages: ChatMessage[] = [
      { role: "system", content: agentConfig.systemPrompt },
      { role: "user", content: prompt },
    ];
    return generate(messages, options?.onChunk);
  }

  const systemContent = agentConfig.systemPrompt + AUTONOMOUS_INSTRUCTIONS;
  const systemMsg: ChatMessage = { role: "system", content: systemContent };
  const history: ChatMessage[] = [{ role: "user", content: prompt }];

  for (let i = 0; i < MAX_REASONING_STEPS; i++) {
    const messages: ChatMessage[] = [systemMsg, ...history];
    const response = await generate(messages, i === 0 ? options?.onChunk : undefined);
    const step = parseStep(response);

    options?.onStep?.(step);
    history.push({ role: "assistant", content: response });

    if (step.type === "answer") {
      return step.content;
    }

    if (step.type === "tool_call") {
      const parsed = parseToolCall(step.content);
      let result: string;
      if (parsed) {
        result = await executeTool(parsed.name, parsed.args, options?.toolContext ?? {});
      } else {
        result = "Error: Could not parse tool call.";
      }

      const resultStep: AgentStep = { type: "tool_result", content: result };
      options?.onStep?.(resultStep);

      history.push({
        role: "user",
        content: `[TOOL_RESULT] ${result}\n\nContinue. Use [THINKING] to reason about the result, [TOOL_CALL] to use another tool, or [ANSWER] for the final response.`,
      });
      continue;
    }

    history.push({
      role: "user",
      content: "Continue. Use [THINKING] for more reasoning, [TOOL_CALL] to use a tool, or [ANSWER] for the final response.",
    });
  }

  const lastMsg = history[history.length - 1];
  return lastMsg?.content ?? "I was unable to reach a conclusion.";
}

export function useAgent(
  initialConfig?: AgentConfig,
  onSave?: (config: AgentConfig) => void
) {
  const [config, setConfig] = useState<AgentConfig>(initialConfig ?? DEFAULT_CONFIG);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isReasoning, setIsReasoning] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);

  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      onSave?.(next);
      return next;
    });
  }, [onSave]);

  const setFullConfig = useCallback((newConfig: AgentConfig) => {
    setConfig(newConfig);
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

          historyRef.current.push({
            role: "user",
            content: `[TOOL_RESULT] ${result}\n\nContinue. Use [THINKING] to reason about the result, [TOOL_CALL] to use another tool, or [ANSWER] for the final response.`,
          });
          continue;
        }

        historyRef.current.push({
          role: "user",
          content: "Continue. Use [THINKING] for more reasoning, [TOOL_CALL] to use a tool, or [ANSWER] for the final response.",
        });
      }

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
    setFullConfig,
    buildMessages,
    addAssistantMessage,
    runAutonomous,
    clearHistory,
    history: historyRef,
  };
}
