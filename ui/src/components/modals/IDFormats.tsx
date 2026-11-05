import { generateNpub } from "@/logic/nostr";
import type { UrbitID, UserType } from "@/types/nostrill";
import { copyToClipboard } from "@/utils";

function UrbitFormats({ uid }: { uid: UrbitID }) {
  return (
    <div>
      <p>Groundwire ID</p>
      <p onClick={(e) => copyToClipboard(e, uid.gwid.english.abridged)}>
        {uid.gwid.english.abridged}
      </p>
      <p onClick={(e) => copyToClipboard(e, uid.gwid.english.foreshortened)}>
        {uid.gwid.english.foreshortened}
      </p>
      <p onClick={(e) => copyToClipboard(e, uid.gwid.english.nym)}>
        {uid.gwid.english.nym}
      </p>
      <label>
        @p
        <p onClick={(e) => copyToClipboard(e, uid.patp)}>{uid.patp}</p>
      </label>
      <label>
        Azimuth point
        <p onClick={(e) => copyToClipboard(e, uid.point.toLocaleString())}>
          {uid.point.toLocaleString()}
        </p>
      </label>
    </div>
  );
}
function NostrFormats({ pubkey }: { pubkey: string }) {
  const npub = generateNpub(pubkey);
  return (
    <div>
      <label>
        npub
        <p onClick={(e) => copyToClipboard(e, npub)}>{npub}</p>
      </label>
      <label>
        pubkey
        <p onClick={(e) => copyToClipboard(e, pubkey)}>{pubkey}</p>
      </label>
    </div>
  );
}

export default function ({ user }: { user: UserType }) {
  if ("urbit" in user) return <UrbitFormats uid={user.urbit} />;
  if ("nostr" in user) return <NostrFormats pubkey={user.nostr} />;
  else return null;
}
