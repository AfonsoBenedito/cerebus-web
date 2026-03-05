import "./MessageBubble.css";

interface MessageBubbleProps {
  className: string;
  label?: string;
  badge?: string;
  children: React.ReactNode;
}

export function MessageBubble({ className, label, badge, children }: MessageBubbleProps) {
  return (
    <div className={`message ${className}`}>
      {badge && <span className="agent-badge">{badge}</span>}
      {label && <strong>{label}</strong>}
      {children}
    </div>
  );
}
