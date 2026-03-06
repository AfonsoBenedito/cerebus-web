import { useState, useRef, useCallback, useEffect } from "react";
import Peer from "peerjs";
import type { DataConnection } from "peerjs";

export interface PeerMessage {
  type: "chat" | "llm-request" | "llm-response" | "llm-loading" | "llm-thinking" | "system";
  payload: string;
  sender: string;
  timestamp: number;
}

export function usePeer() {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);

  const addMessage = useCallback((msg: PeerMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const setupConnection = useCallback(
    (conn: DataConnection) => {
      conn.on("open", () => {
        connectionsRef.current = [...connectionsRef.current, conn];
        setConnections([...connectionsRef.current]);
        setConnected(true);
        addMessage({
          type: "system",
          payload: `Connected to peer: ${conn.peer}`,
          sender: "system",
          timestamp: Date.now(),
        });
      });

      conn.on("data", (data) => {
        const msg = data as PeerMessage;
        addMessage(msg);
      });

      conn.on("close", () => {
        connectionsRef.current = connectionsRef.current.filter(
          (c) => c !== conn
        );
        setConnections([...connectionsRef.current]);
        setConnected(connectionsRef.current.length > 0);
        addMessage({
          type: "system",
          payload: `Peer disconnected: ${conn.peer}`,
          sender: "system",
          timestamp: Date.now(),
        });
      });
    },
    [addMessage]
  );

  const initialize = useCallback((username: string) => {
    if (peerRef.current) return;

    const sanitized = username.trim().toUpperCase().replace(/\s+/g, "");
    const peer = new Peer(sanitized, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
      },
    });
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
    });

    peer.on("connection", (conn) => {
      setupConnection(conn);
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      addMessage({
        type: "system",
        payload: `Peer error: ${err.message}`,
        sender: "system",
        timestamp: Date.now(),
      });
    });
  }, [setupConnection, addMessage]);

  const connectToPeer = useCallback(
    (remotePeerId: string) => {
      const peer = peerRef.current;
      if (!peer) return;

      const sanitized = remotePeerId.trim().toUpperCase().replace(/\s+/g, "");
      const conn = peer.connect(sanitized);
      setupConnection(conn);
    },
    [setupConnection]
  );

  const sendMessage = useCallback(
    (msg: PeerMessage) => {
      connectionsRef.current.forEach((conn) => {
        if (conn.open) {
          conn.send(msg);
        }
      });
      addMessage(msg);
    },
    [addMessage]
  );

  const disconnect = useCallback(() => {
    connectionsRef.current.forEach((conn) => conn.close());
    connectionsRef.current = [];
    setConnections([]);
    setConnected(false);
    peerRef.current?.destroy();
    peerRef.current = null;
    setPeerId(null);
  }, []);

  useEffect(() => {
    return () => {
      peerRef.current?.destroy();
    };
  }, []);

  return {
    peerId,
    connections,
    connected,
    messages,
    initialize,
    connectToPeer,
    sendMessage,
    disconnect,
  };
}
