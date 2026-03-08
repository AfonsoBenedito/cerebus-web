import { useState, useEffect, useCallback, useRef } from "react";

const DB_NAME = "cerebus-fs";
const STORE_NAME = "handles";
const ROOT_KEY = "root-directory";

// --- IndexedDB helpers (only stores the directory handle for cross-session persistence) ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(ROOT_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, ROOT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(ROOT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- File I/O helpers ---

async function writeJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  subfolder: string,
  filename: string,
  data: unknown
): Promise<void> {
  const subDir = await dirHandle.getDirectoryHandle(subfolder, { create: true });
  const fileHandle = await subDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function writeRootJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  data: unknown
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readRootJsonFile<T>(
  dirHandle: FileSystemDirectoryHandle,
  filename: string
): Promise<T | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readAllJsonFiles<T>(
  dirHandle: FileSystemDirectoryHandle,
  subfolder: string
): Promise<T[]> {
  try {
    const subDir = await dirHandle.getDirectoryHandle(subfolder);
    const items: T[] = [];
    for await (const entry of subDir.values()) {
      if (entry.kind === "file" && entry.name.endsWith(".json")) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          items.push(JSON.parse(text));
        } catch {
          // skip corrupt files
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function deleteJsonFile(
  dirHandle: FileSystemDirectoryHandle,
  subfolder: string,
  filename: string
): Promise<void> {
  try {
    const subDir = await dirHandle.getDirectoryHandle(subfolder);
    await subDir.removeEntry(filename);
  } catch {
    // file may not exist
  }
}

// --- Naming conventions ---

function agentFilename(id: string): string {
  return `agent_${id}.json`;
}

function taskFilename(id: string): string {
  return `task_${id}.json`;
}

// --- Model manifest ---

export interface ModelManifest {
  activeModel: string | null;
  selectedModel: string | null;
  lastUsed: number;
}

// --- Hook ---

async function createFolderStructure(handle: FileSystemDirectoryHandle) {
  await handle.getDirectoryHandle("agents", { create: true });
  await handle.getDirectoryHandle("tasks", { create: true });
  await handle.getDirectoryHandle("models", { create: true });
}

export function useFileSystem() {
  const [isLinked, setIsLinked] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [hasSavedHandle, setHasSavedHandle] = useState(false);
  const rootRef = useRef<FileSystemDirectoryHandle | null>(null);
  const lastWriteTimeRef = useRef(0);

  // Check if there's a saved handle on mount
  useEffect(() => {
    loadHandle().then((handle) => {
      if (handle) setHasSavedHandle(true);
      if (handle) {
        handle.queryPermission({ mode: "readwrite" }).then((perm) => {
          if (perm === "granted") {
            rootRef.current = handle;
            setFolderName(handle.name);
            setIsLinked(true);
          }
        }).catch(() => {});
      }
    });
  }, []);

  const reconnect = useCallback(async (): Promise<boolean> => {
    const handle = await loadHandle();
    if (!handle) return false;

    try {
      const permission = await handle.requestPermission({ mode: "readwrite" });
      if (permission === "granted") {
        await createFolderStructure(handle);
        rootRef.current = handle;
        setFolderName(handle.name);
        setIsLinked(true);
        return true;
      }
    } catch {
      // User denied or handle stale
    }
    return false;
  }, []);

  const pickDirectory = useCallback(async (): Promise<boolean> => {
    try {
      const handle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      await createFolderStructure(handle);
      await saveHandle(handle);
      rootRef.current = handle;
      setFolderName(handle.name);
      setHasSavedHandle(true);
      setIsLinked(true);
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return false;
      throw err;
    }
  }, []);

  const unlink = useCallback(async () => {
    await clearHandle();
    rootRef.current = null;
    setFolderName(null);
    setHasSavedHandle(false);
    setIsLinked(false);
  }, []);

  // --- Agent file operations ---

  const writeAgent = useCallback(async (agent: { id: string }) => {
    if (!rootRef.current) return;
    lastWriteTimeRef.current = Date.now();
    await writeJsonFile(rootRef.current, "agents", agentFilename(agent.id), agent);
  }, []);

  const readAgents = useCallback(async <T>(): Promise<T[]> => {
    if (!rootRef.current) return [];
    return readAllJsonFiles<T>(rootRef.current, "agents");
  }, []);

  const deleteAgentFile = useCallback(async (id: string) => {
    if (!rootRef.current) return;
    lastWriteTimeRef.current = Date.now();
    await deleteJsonFile(rootRef.current, "agents", agentFilename(id));
  }, []);

  // --- Task file operations ---

  const writeTask = useCallback(async (task: { id: string }) => {
    if (!rootRef.current) return;
    lastWriteTimeRef.current = Date.now();
    await writeJsonFile(rootRef.current, "tasks", taskFilename(task.id), task);
  }, []);

  const readTasks = useCallback(async <T>(): Promise<T[]> => {
    if (!rootRef.current) return [];
    return readAllJsonFiles<T>(rootRef.current, "tasks");
  }, []);

  const deleteTaskFile = useCallback(async (id: string) => {
    if (!rootRef.current) return;
    lastWriteTimeRef.current = Date.now();
    await deleteJsonFile(rootRef.current, "tasks", taskFilename(id));
  }, []);

  // --- Model manifest operations ---

  const writeModelManifest = useCallback(async (manifest: ModelManifest) => {
    if (!rootRef.current) return;
    lastWriteTimeRef.current = Date.now();
    await writeJsonFile(rootRef.current, "models", "manifest.json", manifest);
  }, []);

  const readModelManifest = useCallback(async (): Promise<ModelManifest | null> => {
    if (!rootRef.current) return null;
    try {
      const modelsDir = await rootRef.current.getDirectoryHandle("models");
      const fileHandle = await modelsDir.getFileHandle("manifest.json");
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }, []);

  // --- Project config (peer agent config) ---

  const writeProjectConfig = useCallback(async (config: unknown) => {
    if (!rootRef.current) return;
    lastWriteTimeRef.current = Date.now();
    await writeRootJsonFile(rootRef.current, "config.json", config);
  }, []);

  const readProjectConfig = useCallback(async <T>(): Promise<T | null> => {
    if (!rootRef.current) return null;
    return readRootJsonFile<T>(rootRef.current, "config.json");
  }, []);

  const isWriteRecent = useCallback((): boolean => {
    return Date.now() - lastWriteTimeRef.current < 2000;
  }, []);

  return {
    isLinked,
    folderName,
    hasSavedHandle,
    pickDirectory,
    reconnect,
    unlink,
    writeAgent,
    readAgents,
    deleteAgentFile,
    writeTask,
    readTasks,
    deleteTaskFile,
    writeModelManifest,
    readModelManifest,
    writeProjectConfig,
    readProjectConfig,
    isWriteRecent,
  };
}
