import Avatar from "@/components/Avatar";
import UserModal from "@/components/modals/UserModal";
import type { UrbitID } from "@/types/nostrill";
import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Image,
  Link as LinkIcon,
  MoreHorizontal,
  Search,
  ShieldOff,
} from "lucide-react";
import type { RefObject } from "react";
import type { DmPanel } from "./types";

export default function DmConversationHeader({
  peer,
  name,
  id2,
  muted,
  blocked,
  menuOpen,
  menuRef,
  onBack,
  onOpenPeer,
  onToggleMenu,
  onToggleMuted,
  onToggleBlocked,
  onOpenPanel,
}: {
  peer: UrbitID;
  name: string;
  id2: string;
  muted: boolean;
  blocked: boolean;
  menuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onOpenPeer: () => void;
  onToggleMenu: () => void;
  onToggleMuted: () => void;
  onToggleBlocked: () => void;
  onOpenPanel: (panel: DmPanel) => void;
}) {
  return (
    <header className="trill-screen-header dm-conversation-header">
      <button
        type="button"
        className="dm-icon-button"
        onClick={onBack}
        aria-label="Back to messages"
      >
        <ArrowLeft size={20} strokeWidth={2} />
      </button>
      <button type="button" className="dm-peer-button" onClick={onOpenPeer}>
        <Avatar user={{ urbit: peer }} size={38} noClick picOnly />
        <span className="dm-peer-copy">
          <span className="dm-peer-name">{name}</span>
          <span className="dm-peer-id mono">{id2}</span>
          <span className="dm-peer-states">
            {blocked && (
              <span className="dm-peer-state blocked">
                <Ban size={11} />
                blocked
              </span>
            )}
            {!blocked && muted && (
              <span className="dm-peer-state muted">
                <BellOff size={11} />
                muted
              </span>
            )}
          </span>
        </span>
      </button>
      <div className="dm-header-menu" ref={menuRef}>
        <button
          type="button"
          className="dm-icon-button"
          onClick={onToggleMenu}
          aria-label="Conversation options"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={20} strokeWidth={2} />
        </button>
        {menuOpen && (
          <div className="dm-context-menu" role="menu">
            <button type="button" role="menuitem" onClick={onToggleMuted}>
              {muted ? <Bell size={16} /> : <BellOff size={16} />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" role="menuitem" onClick={onToggleBlocked}>
              {blocked ? <ShieldOff size={16} /> : <Ban size={16} />}
              {blocked ? "Unblock" : "Block"}
            </button>
            <button type="button" role="menuitem" onClick={() => onOpenPanel("search")}>
              <Search size={16} />
              Search
            </button>
            <button type="button" role="menuitem" onClick={() => onOpenPanel("media")}>
              <Image size={16} />
              Media
            </button>
            <button type="button" role="menuitem" onClick={() => onOpenPanel("links")}>
              <LinkIcon size={16} />
              Links
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function openUserModal(peer: UrbitID) {
  return <UserModal user={{ urbit: peer }} />;
}
