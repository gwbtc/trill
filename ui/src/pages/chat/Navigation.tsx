import { Link } from "wouter";
export default function ChatNavigation({
  active,
}: {
  active: "messages" | "groups";
}) {
  return (
    <nav className="chat-navigation" aria-label="Chat navigation">
      <Link
        href="/dms"
        aria-current={active === "messages" ? "page" : undefined}
      >
        Messages
      </Link>
      <Link
        href="/groups"
        aria-current={active === "groups" ? "page" : undefined}
      >
        Groups
      </Link>
    </nav>
  );
}
