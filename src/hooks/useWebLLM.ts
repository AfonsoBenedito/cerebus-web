import { useState, useRef, useCallback } from "react";
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

export type ModelStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ModelOption {
  id: string;
  label: string;
  size: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "SmolLM2-135M-Instruct-q0f16-MLC", label: "SmolLM2 135M", size: "~135MB" },
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", label: "SmolLM2 360M", size: "~250MB" },
  { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B", size: "~1GB" },
  { id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC", label: "TinyLlama 1.1B", size: "~600MB" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", size: "~700MB" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B", size: "~1.8GB" },
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B", size: "~1.3GB" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 1.5B", size: "~900MB" },
  { id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 Coder 1.5B", size: "~900MB" },
  { id: "DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC", label: "DeepSeek R1 1.5B", size: "~900MB" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", label: "Phi 3.5 Mini", size: "~2.2GB" },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC-1k", label: "Llama 3.1 8B (1k ctx)", size: "~4.5GB" },
];

export function useWebLLM() {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const engineRef = useRef<MLCEngine | null>(null);

  const loadModel = useCallback(async (modelId: string) => {
    try {
      if (engineRef.current) {
        engineRef.current.unload();
        engineRef.current = null;
      }

      setStatus("loading");
      setError(null);
      setLoadProgress(0);
      setActiveModel(modelId);

      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          setLoadProgress(Math.round(progress.progress * 100));
        },
      });

      engineRef.current = engine;
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      setActiveModel(null);
    }
  }, []);

  const generate = useCallback(
    async (
      messages: ChatMessage[],
      onChunk?: (text: string) => void
    ): Promise<string> => {
      const engine = engineRef.current;
      if (!engine) throw new Error("Model not loaded");

      setStatus("generating");
      try {
        let result = "";

        const reply = await engine.chat.completions.create({
          messages,
          stream: true,
        });

        for await (const chunk of reply) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          result += delta;
          onChunk?.(result);
        }

        setStatus("ready");
        return result;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    []
  );

  return { status, loadProgress, error, activeModel, loadModel, generate };
}
