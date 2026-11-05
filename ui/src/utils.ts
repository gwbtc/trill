import toast from "react-hot-toast";

export async function copyToClipboard(e: React.MouseEvent, text: string) {
  e.stopPropagation();
  await navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}
