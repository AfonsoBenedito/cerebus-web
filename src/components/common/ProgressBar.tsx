import "./ProgressBar.css";

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="progress">
      <div className="progress-bar" style={{ width: `${progress}%` }} />
      <span>{label ?? `${progress}%`}</span>
    </div>
  );
}
