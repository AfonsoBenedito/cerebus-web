import { useState, useRef, useCallback, useEffect } from "react";
import { CreateMLCEngine, MLCEngine, deleteModelAllInfoInCache, hasModelInCache } from "@mlc-ai/web-llm";

export type ModelStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ModelOption {
  id: string;
  label: string;
  size: string;
  vramMB: number;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "SmolLM2-135M-Instruct-q0f16-MLC", label: "SmolLM2 135M", size: "~135MB", vramMB: 135 },
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", label: "SmolLM2 360M", size: "~250MB", vramMB: 250 },
  { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B", size: "~1GB", vramMB: 1000 },
  { id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC", label: "TinyLlama 1.1B", size: "~600MB", vramMB: 600 },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", size: "~700MB", vramMB: 700 },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B", size: "~1.8GB", vramMB: 1800 },
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B", size: "~1.3GB", vramMB: 1300 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 1.5B", size: "~900MB", vramMB: 900 },
  { id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 Coder 1.5B", size: "~900MB", vramMB: 900 },
  { id: "DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC", label: "DeepSeek R1 1.5B", size: "~900MB", vramMB: 900 },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", label: "Phi 3.5 Mini", size: "~2.2GB", vramMB: 2200 },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC-1k", label: "Llama 3.1 8B (1k ctx)", size: "~4.5GB", vramMB: 4500 },
];

async function detectGPUMemoryMB(): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;
    const maxBuffer = adapter.limits.maxBufferSize;
    return Math.floor(maxBuffer / (1024 * 1024));
  } catch {
    return null;
  }
}

export function useGPUMemory() {
  const [gpuMemoryMB, setGpuMemoryMB] = useState<number | null>(null);

  useEffect(() => {
    detectGPUMemoryMB().then(setGpuMemoryMB);
  }, []);

  const availableModels = gpuMemoryMB !== null
    ? AVAILABLE_MODELS.filter((m) => m.vramMB <= gpuMemoryMB)
    : AVAILABLE_MODELS;

  return { gpuMemoryMB, availableModels };
}

/** Check which models are already downloaded in the browser Cache API */
export async function getCachedModelIds(): Promise<string[]> {
  const cached: string[] = [];
  for (const model of AVAILABLE_MODELS) {
    try {
      if (await hasModelInCache(model.id)) {
        cached.push(model.id);
      }
    } catch {
      // skip
    }
  }
  return cached;
}

export function useWebLLM() {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [cachedModels, setCachedModels] = useState<string[]>([]);
  const engineRef = useRef<MLCEngine | null>(null);

  // Scan cache on mount
  useEffect(() => {
    getCachedModelIds().then(setCachedModels);
  }, []);

  const refreshCache = useCallback(async () => {
    setCachedModels(await getCachedModelIds());
  }, []);

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

      // Update cached models list (model is now in cache)
      setCachedModels((prev) => prev.includes(modelId) ? prev : [...prev, modelId]);
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

  const unloadModel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.unload();
      engineRef.current = null;
    }
    setStatus("idle");
    setActiveModel(null);
    setError(null);
  }, []);

  const deleteFromCache = useCallback(async (modelId: string) => {
    // If this model is currently loaded, unload it first
    if (activeModel === modelId && engineRef.current) {
      engineRef.current.unload();
      engineRef.current = null;
      setStatus("idle");
      setActiveModel(null);
      setError(null);
    }
    await deleteModelAllInfoInCache(modelId);
    setCachedModels((prev) => prev.filter((id) => id !== modelId));
  }, [activeModel]);

  const clearAllCache = useCallback(async () => {
    if (engineRef.current) {
      engineRef.current.unload();
      engineRef.current = null;
    }
    setStatus("idle");
    setActiveModel(null);
    setError(null);

    for (const modelId of cachedModels) {
      await deleteModelAllInfoInCache(modelId);
    }
    setCachedModels([]);
  }, [cachedModels]);

  return {
    status,
    loadProgress,
    error,
    activeModel,
    cachedModels,
    loadModel,
    unloadModel,
    deleteFromCache,
    clearAllCache,
    refreshCache,
    generate,
  };
}
