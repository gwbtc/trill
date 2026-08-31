import type { MouseEvent, ReactNode } from "react";

export interface TabItem<T extends string> {
  key: T;
  label: ReactNode;
}

interface TabStripProps<T extends string> {
  id?: string;
  items: readonly TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className: string;
  buttonClassName?: string;
  activeClassName?: string;
  getButtonClassName?: (item: TabItem<T>, active: boolean) => string;
  itemElement?: "button" | "div";
  itemRole?: string;
  stopPropagation?: boolean;
}

export default function TabStrip<T extends string>({
  id,
  items,
  active,
  onChange,
  className,
  buttonClassName = "",
  activeClassName = "active",
  getButtonClassName,
  itemElement = "button",
  itemRole,
  stopPropagation = false,
}: TabStripProps<T>) {
  return (
    <div
      id={id}
      className={className}
      role={itemRole === "tab" ? "tablist" : undefined}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const computedClassName =
          getButtonClassName?.(item, isActive) ??
          `${buttonClassName}${isActive ? ` ${activeClassName}` : ""}`.trim();
        const onClick = (event: MouseEvent) => {
          if (stopPropagation) event.stopPropagation();
          onChange(item.key);
        };
        return itemElement === "div" ? (
          <div
            key={item.key}
            role={itemRole}
            className={computedClassName}
            onClick={onClick}
          >
            {item.label}
          </div>
        ) : (
          <button
            type="button"
            key={item.key}
            role={itemRole}
            aria-selected={itemRole === "tab" ? isActive : undefined}
            className={computedClassName}
            onClick={onClick}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
