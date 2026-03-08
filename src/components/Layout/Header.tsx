import { useState } from "react";
import "./Header.css";

interface HeaderProps {
  isLinked: boolean;
  folderName: string | null;
  hasSavedHandle: boolean;
  onPickDirectory: () => Promise<boolean>;
  onReconnect: () => Promise<boolean>;
  onUnlink: () => void;
}

export function Header({ isLinked, folderName, hasSavedHandle, onPickDirectory, onReconnect, onUnlink }: HeaderProps) {
  const [reconnecting, setReconnecting] = useState(false);

  const handleReconnect = async () => {
    setReconnecting(true);
    const ok = await onReconnect();
    setReconnecting(false);
    if (!ok) {
      alert("Could not reconnect. The folder may have been moved, or permission was denied. Try 'Set Project Folder' to pick it again.");
    }
  };

  return (
    <header className="header">
      <div className="header-top">
        <div>
          <h1>Cerebus</h1>
          <p className="subtitle">Local LLM + P2P Chat</p>
        </div>
        <div className="header-fs">
          {isLinked ? (
            <>
              <span className="fs-linked" title={`Syncing to ${folderName}/`}>
                <span className="fs-dot" />
                {folderName}/
              </span>
              <button className="btn fs-btn" onClick={onUnlink}>Unlink</button>
            </>
          ) : (
            <>
              {hasSavedHandle && (
                <button
                  className="btn primary fs-btn"
                  onClick={handleReconnect}
                  disabled={reconnecting}
                >
                  {reconnecting ? "Reconnecting..." : "Reconnect"}
                </button>
              )}
              <button className="btn fs-btn" onClick={onPickDirectory}>
                {hasSavedHandle ? "Pick New Folder" : "Set Project Folder"}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
