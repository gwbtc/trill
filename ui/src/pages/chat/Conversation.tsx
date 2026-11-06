import Avatar from "@/components/Avatar";
import { patpToFallbackUID } from "@/logic/gw";
import type { TlonConversation } from "@/logic/tlon/types";
import useLocalState from "@/state/state";
import { Users } from "lucide-react";

export function ConversationAvatar({
  conversation,
  size = 44,
}: {
  conversation: TlonConversation;
  size?: number;
}) {
  const profile = useLocalState((s) => s.profiles.get(conversation.id));
  return conversation.kind === "direct" ? (
    <Avatar
      user={{ urbit: patpToFallbackUID(conversation.id) }}
      profile={profile}
      size={size}
      noClick
      picOnly
    />
  ) : (
    <span className="dm-group-avatar" style={{ width: size, height: size }}>
      <Users size={size / 2} aria-label="Group conversation" />
    </span>
  );
}
export function useConversationName(
  conversation: TlonConversation | undefined,
) {
  const profiles = useLocalState((s) => s.profiles);
  if (!conversation) return "Conversation";
  if (conversation.kind === "direct")
    return (
      profiles.get(conversation.id)?.name ||
      patpToFallbackUID(conversation.id).gwid.english.abridged ||
      conversation.id
    );
  return conversation.title && conversation.title !== conversation.id
    ? conversation.title
    : [...new Set([...conversation.members, ...conversation.invitedMembers])]
        .map((id) => profiles.get(id)?.name || id)
        .join(", ") || "Group message";
}
