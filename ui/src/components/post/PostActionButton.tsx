import type { ReactNode } from "react";

export default function PostActionButton({
  className,
  active,
  onClick,
  icon,
  count,
  countClassName,
  onCountClick,
  ariaLabel,
  children,
}: {
  className: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  icon: ReactNode;
  count: string;
  countClassName: string;
  onCountClick?: (e: React.MouseEvent) => void;
  ariaLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`icon-container ${className}${active ? " active" : ""}`}
      role={ariaLabel ? "button" : "link"}
      tabIndex={ariaLabel ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!ariaLabel || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.currentTarget.click();
      }}
    >
      <div className="icon-wrapper">{icon}</div>
      <span
        role={onCountClick ? "link" : undefined}
        onClick={onCountClick}
        className={`${countClassName} icon-count`}
      >
        {count}
      </span>
      {children}
    </div>
  );
}
