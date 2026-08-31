import { Check, Copy } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface CodeBlockProps {
  children: string;
  className?: string;
}

import "@/styles/CodeBlock.css";

export default function CodeBlock({
  children,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className={`code-block-container ${className}`}>
      <button
        onClick={handleCopy}
        className="code-block-copy-btn"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check size={14} className="code-check-icon" />
        ) : (
          <Copy size={14} />
        )}
      </button>
      <pre className="code-block-content">{children}</pre>
    </div>
  );
}
