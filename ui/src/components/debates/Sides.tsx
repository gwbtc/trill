// "Cats vs Dogs", each side in its color
export default function Sides({ a, b }: { a: string; b: string }) {
  return (
    <span className="debate-sides">
      <span className="debate-side-name a">{a}</span>
      <span className="debate-vs">vs</span>
      <span className="debate-side-name b">{b}</span>
    </span>
  );
}
