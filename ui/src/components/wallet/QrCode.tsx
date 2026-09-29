import { useMemo } from "react";
import { encode } from "uqr";

// a QR code as one SVG path: dark modules on white whatever the theme,
// since scanners want the contrast
export default function QrCode({ value, label, size = 208 }: { value: string; label: string; size?: number }) {
  const { d, n } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let path = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) path += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { d: path, n: qr.size };
  }, [value]);
  return (
    <svg
      className="wallet-qr"
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  );
}
