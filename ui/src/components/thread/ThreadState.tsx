import type { ReactNode } from "react";
import spinner from "@/assets/triangles.svg";
import "@/styles/ThreadState.css";

export default function ThreadState({ title, children, loading = false, compact = false }: {
  title: string;
  children?: ReactNode;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <section className={`thread-state${compact ? " thread-state-compact" : ""}`} role="status">
      {loading && <img src={spinner} alt="" aria-hidden="true" />}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </section>
  );
}
