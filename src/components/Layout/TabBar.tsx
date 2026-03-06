import "./TabBar.css";

export type Tab = "llm" | "peer";

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  peerConnected: boolean;
}

export function TabBar({ activeTab, onTabChange, peerConnected }: TabBarProps) {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === "peer" ? "active" : ""}`}
        onClick={() => onTabChange("peer")}
      >
        P2P Chat {peerConnected && <span className="dot" />}
      </button>
      <button
        className={`tab ${activeTab === "llm" ? "active" : ""}`}
        onClick={() => onTabChange("llm")}
      >
        Local LLM
      </button>
    </div>
  );
}
