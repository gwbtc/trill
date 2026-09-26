import type Urbit from "urbit-api";
import type { Cursor, FullNode, Gate, PostID, PostPerms } from "@/types/trill";
import { patpToFallbackUID } from "@/logic/gw";
import type { PostRef } from "@/logic/lists";
import type {
  S3Config,
  SettingsRes,
  Ship,
  StorageConfigurationRes,
  StorageCredentialsRes,
  UrbitContacts,
} from "@/types/urbit";
import {
  FeedPostCount,
  PROFILES_SUB_NAME,
  SYNC_SUB_NAME,
} from "../constants";
import type {
  BasicProfile,
  DM,
  GroundwireID,
  NostrFeeds,
  PeekDMRes,
  PeekDMInboxRes,
  PeekFeedRes,
  PeekRes,
  PeekThreadRes,
  ReplyPolicy,
  UserProfile,
  UserType,
} from "@/types/nostrill";
import type { AsyncRes } from "@/types/ui";
import type { Rope, Skein } from "@/types/hark";
import type { TopicPrefs } from "@/logic/topics";

// the UI carries full UrbitIDs, but the backend's user decoder
// (user:de:common) only takes { urbit: "~ship" } | { nostr: "hex" }; an
// object-shaped urbit user fails to decode and the poke is silently dropped
type WireUser = { urbit: string } | { nostr: string };
function toWireUser(user: UserType): WireUser {
  return "urbit" in user ? { urbit: user.urbit.patp } : user;
}

// thread scries/peeks send nodes without authorFull (feed scries include
// it), and every thread renderer reads node.authorFull.author; fill it in
// from the patps so a missing field can't crash the page
function withAuthorFull(node: FullNode): FullNode {
  const children = Array.isArray(node.children)
    ? node.children
    : Object.fromEntries(
        Object.entries(node.children ?? {}).map(([k, c]) => [k, withAuthorFull(c)]),
      );
  return {
    ...node,
    authorFull: node.authorFull ?? {
      author: patpToFallbackUID(node.author),
      host: patpToFallbackUID(node.host),
    },
    children,
  };
}
function normalizeThread(res: PeekThreadRes): PeekThreadRes {
  const d = res.data.data;
  if (!d || d === "maybe") return res;
  const data = { node: withAuthorFull(d.node), thread: d.thread.map(withAuthorFull) };
  return { ...res, data: { ...res.data, data } };
}

// Subscribe
type Handler = (date: any) => void;
export default class IO {
  airlock;
  subs: Map<string, number> = new Map();
  constructor(airlock: Urbit) {
    this.airlock = airlock;
  }
  private async thread(threadName: string, json: any) {
    return this.airlock.thread({
      body: json,
      inputMark: "json",
      outputMark: "json",
      threadName,
    });
  }
  private async poke(json: any, agent?: string, marc?: string): AsyncRes<number> {
    const app = agent ? agent : "nostrill";
    const mark = marc ? marc : "json";
    // airlock.poke resolves once the message is PUT to the channel, not
    // when the agent acks it; a nack (the agent crashed) only reaches
    // onError. wait for the ack so { ok } means the poke actually landed
    return new Promise((resolve) => {
      let id: number | undefined;
      let acked = false;
      const done = () => {
        if (acked && id !== undefined) resolve({ ok: id });
      };
      this.airlock
        .poke({
          app,
          mark,
          json,
          onSuccess: () => {
            acked = true;
            done();
          },
          onError: (e) => resolve({ error: `${e}` }),
        })
        .then(
          (res) => {
            id = res;
            done();
          },
          (e) => resolve({ error: `${e}` }),
        );
    });
  }
  private async scry(path: string, agent?: string) {
    try {
      const app = agent ? agent : "nostrill";
      const res = await this.airlock.scry({ app, path });
      return { ok: res };
    } catch (e) {
      return { error: `${e}` };
    }
  }
  private async sub(path: string, handler: Handler, agent?: string) {
    const app = agent ? agent : "nostrill";
    // keyed per agent: nostrill, hark and noschat all serve "/ui"
    const key = `${app}${path}`;
    if (this.subs.has(key)) return;

    const err = (err: any, _id: string) =>
      console.error(err, `error on ${app} subscription`);
    const quit = (data: any) => {
      console.error(data, `${app} subscription kicked`);
      this.subs.delete(key);
    };
    const res = await this.airlock.subscribe({
      app,
      path,
      event: handler,
      err,
      quit,
    });
    this.subs.set(key, res);
    return res;
  }
  async unsub(sub: number) {
    return await this.airlock.unsubscribe(sub);
  }
  // subs
  async subscribeNostrill(handler: Handler) {
    const res = await this.sub("/ui", handler);
    return res;
  }
  async subscribeHark(handler: Handler) {
    const res = await this.sub("/ui", handler, "hark");
    return res;
  }
  // scries

  async scryFeed(
    host: Ship,
    start: Cursor,
    end: Cursor,
    desc = true,

    replies = false,
  ) {
    const order = desc ? 1 : 0;
    const rp = replies ? 1 : 0;

    const path = `/j/feed/${host}/${start}/${end}/${FeedPostCount}/${order}/${rp}`;
    return await this.scry(path);
  }
  async scryThread(
    host: Ship,
    id: PostID,
    // start: Cursor,
    // end: Cursor,
    // desc = true,
  ): AsyncRes<PeekThreadRes> {
    // const order = desc ? 1 : 0;

    // const path = `/j/thread/${host}/${id}/${start}/${end}/${FeedPostCount}/${order}`;
    const path = `/j/thread/${host}/${id}`;
    const res = await this.scry(path);
    if ("error" in res) return res;
    const r = res.ok as { thread: PeekThreadRes };
    if (!("thread" in r)) return { error: "wrong result" };
    return { ok: normalizeThread(r.thread) };
  }
  async scryGwid(patp: string): AsyncRes<GroundwireID>{
    const path = `/j/gwid/${patp}`;
    return await this.scry(path);
      }
  async scryPatp(gwid: string): AsyncRes<string>{
    const path = `/j/patp/${gwid}`;
    return await this.scry(path);
      }
  async scryRelays() {
    const path = `/j/relays`;
    return await this.scry(path);
  }
  // async scryHark(): AsyncRes<Skein[]> {
  async scryHark(): AsyncRes<Skein[]> {
    // const path3 = "/all/skeins";
    // const path4 = "/all/latest";
    const path = "/desk/nostrill/skeins";
    // const path2 = "/desk/nostrill/latest";
    // this returns Carpet
    const res = await this.scry(path, "hark");
    // const res3 = await this.scry(path3, "hark");
    // const res4 = await this.scry(path4, "hark");
    // const res2 = await this.scry(path2, "hark");
    // console.log("hark all skeins", res3);
    // console.log("hark all latest", res4);
    return res;
  }

  async scryContacts(): AsyncRes<UrbitContacts> {
    const path = "/all";
    const res = await this.scry(path, "n-contacts");
    return res;
  }
  async scrySettings(): AsyncRes<SettingsRes> {
    const path = "/desk/nostrill";
    const res = await this.scry(path, "settings");
    return res;
  }
  async setSettings(
    bucket: string,
    entry: string,
    value: any,
  ): AsyncRes<number> {
    const json = {
      "put-entry": {
        desk: "nostrill",
        "bucket-key": bucket,
        "entry-key": entry,
        value,
      },
    };
    const res = await this.poke(json, "settings", "settings-event");
    return res;
  }
  async scryStorage(): AsyncRes<S3Config> {
    const path = "/credentials";
    const path2 = "/configuration";
    const res = await this.scry(path, "storage");
    const res2 = await this.scry(path2, "storage");
    if ("error" in res) return res;
    if ("error" in res2) return res2;
    const creds: StorageCredentialsRes = res.ok;
    if (!creds["storage-update"].credentials.endpoint)
      return { error: "no credentials" };
    const conf: StorageConfigurationRes = res2.ok;
    const ret = {
      ...creds["storage-update"].credentials,
      ...conf["storage-update"].configuration,
    };
    return { ok: ret };
  }

  // pokes

  // NOTE: the backend ++ui decoder has no %alive, %gate or post %perms poke;
  // pokeAlive, setFeedPerms and setPostPerms are acked and ignored (bad-ui-poke)
  async pokeAlive() {
    return await this.poke({ alive: true });
  }
  async addPost(
    content: string,
    global: boolean,
    anon: boolean,
    reply: ReplyPolicy = "everyone",
  ) {
    const json = { add: { content, global, anon, reply } };
    return this.poke({ post: json });
  }
  async addReply(content: string, host: UserType, id: string, thread: string) {
    const json = { reply: { content, host: toWireUser(host), id, thread } };
    return this.poke({ post: json });
  }
  async addQuote(content: string, host: UserType, id: string) {
    const json = { quote: { content, host: toWireUser(host), id } };
    return this.poke({ post: json });
  }
  // a post sharing a UI card, see logic/cards.ts
  async addCardPost(content: string, card: string) {
    return this.poke({ post: { card: { content, card } } });
  }
  // trending topics from %topics; null when %topics isn't running
  async scryTopics() {
    return await this.scry("/j/topics");
  }
  // %topics refetches everything for the new prefs; %nostrill forwards them
  async setTopicPrefs(prefs: TopicPrefs) {
    return this.poke({ topics: prefs });
  }
  async addRP(host: UserType, id: string) {
    const json = { rp: { host: toWireUser(host), id } };
    return this.poke({ post: json });
  }


  async deletePost(host: UserType, id: string) {
    const json = {
      del: {
        host: toWireUser(host),
        id,
      },
    };
    return this.poke({ post: json });
  }

  async addReact(host: UserType, id: PostID, reaction: string) {
    const json = {
      reaction: {
        reaction: reaction,
        id,
        host: toWireUser(host),
      },
    };

    return this.poke({ post: json });
  }

  async removeReact(host: UserType, id: PostID) {
    const json = { "del-reaction": { host: toWireUser(host), id } };
    return this.poke({ post: json });
  }

  // lists: bookmarks, mutes, reports. the agent answers with a %lists fact
  async bookmark(ref: PostRef, add: boolean) {
    return this.poke({ lists: { bookmark: { add, ref } } });
  }
  async mute(user: UserType, add: boolean) {
    return this.poke({ lists: { mute: { add, user: toWireUser(user) } } });
  }
  async report(ref: PostRef, reason: string) {
    return this.poke({ lists: { report: { ref, reason } } });
  }

  async setFeedPerms(gate: Gate) {
    return this.poke({ gate });
  }

  async setPostPerms(id: string, perms: PostPerms) {
    const json = { perms: { id, perms } };
    return this.poke({ post: json });
  }

  //
  async dismissAllNotifications() {
    const json = { "saw-seam": { desk: "nostrill" } };
    return this.poke(json, "hark", "hark-action-1");
  }
  async dismissNotification(rope: Rope) {
    const json = { "saw-rope": rope };
    return this.poke(json, "hark", "hark-action-1");
  }
  //

  //  follows
  async follow(user: UserType) {
    const json = { add: toWireUser(user) };
    return this.poke({ fols: json });
  }

  async unfollow(user: UserType) {
    const json = { del: toWireUser(user) };
    return await this.poke({ fols: json });
  }
  // profiles
  async createProfile(profile: BasicProfile) {
    const json = { add: profile };
    return await this.poke({ prof: json });
  }
  async deleteProfile() {
    const json = { del: null };
    return await this.poke({ prof: json });
  }
  async cycleKeys() {
    return await this.poke({ keys: null });
  }
  async getProfiles(users: UserType[]) {
    const json = { fetch: users.map(toWireUser) };
    return await this.poke({ prof: json });
  }
  async scryProfile(user?: UserType): AsyncRes<UserProfile> {
    const wire = user && toWireUser(user);
    const path = wire
      ? `/j/profile/${Object.keys(wire)[0]}/${Object.values(wire)[0]}`
      : "/j/profile";
    return await this.scry(path);
  }
  // relays
  async addRelay(url: string) {
    const json = { add: url };
    return await this.poke({ rela: json });
  }
  async deleteRelay(wid: number) {
    const json = { del: wid };
    return await this.poke({ rela: json });
  }
  // works for dormant/mid-backoff relays too, which have no wid
  async deleteRelayUrl(url: string) {
    const json = { "del-url": url };
    return await this.poke({ rela: json });
  }
  // nostr writes
  async relayPost(host: string, id: string, relays: number[]) {
    const json = { do: { relays, action: { "send-post": { host, id } } } };
    return await this.poke({ rela: json });
  }
  async relayProfile(relays: number[]) {
    const json = { do: { relays, action: { "send-prof": null } } };
    return await this.poke({ rela: json });
  }
  // nostr reads
  //
  // read-actions must be wrapped as { get: { name, p } }; the engine only
  // implements %sync and %custom, so user/thread/profile reads go as
  // custom filter subs under a canonical name
  private relayGet(relays: number[], name: string, p: any) {
    const json = { do: { relays, action: { get: { name, p } } } };
    return this.poke({ rela: json });
  }
  // filters use backend JSON conventions: tag keys without the "#" prefix
  private relayCustom(
    relays: number[],
    name: string,
    filters: Record<string, unknown>[],
    ongoing = false,
  ) {
    return this.relayGet(relays, name, {
      custom: { name, filters, ongoing },
    });
  }
  async syncRelays(relays: number[]) {
    return await this.relayGet(relays, SYNC_SUB_NAME, { sync: null });
  }
  async nostrFeed(pubkey: string, relays: number[]) {
    const filters = [{ kinds: [1], authors: [pubkey] }];
    return await this.relayCustom(relays, `user/${pubkey}`, filters);
  }
  async nostrThread(id: string, relays: number[]) {
    const filters = [{ ids: [id] }, { kinds: [1], e: [id] }];
    return await this.relayCustom(relays, `thread/${id}`, filters);
  }
  async nostrProfiles(relays: number[], pubkeys: string[]) {
    const filters = [{ kinds: [0], authors: pubkeys }];
    return await this.relayCustom(relays, PROFILES_SUB_NAME, filters);
  }
  async scryNostr(): AsyncRes<NostrFeeds> {
    return await this.scry(`/j/nostr`);
  }
  // threads
  //
  async peekFeed(host: string): AsyncRes<PeekFeedRes> {
    try {
      const json = { begs: { feed: host } };
      const res = (await this.thread("beg", json)) as PeekRes;
      if (!("feed" in res)) return { error: "request error" };
      else return { ok: res.feed };
    } catch (e) {
      return { error: `${e}` };
    }
  }
  async peekThread(host: string, id: string): AsyncRes<PeekThreadRes> {
    try {
      const json = { begs: { thread: { host, id } } };
      const res = (await this.thread("beg", json)) as PeekRes;
      if (!("thread" in res)) return { error: "request error" };
      else return { ok: normalizeThread(res.thread) };
    } catch (e) {
      return { error: `${e}` };
    }
  }
  // async peekProfile(host: string): AsyncRes<PeekProfileRes> {
  //   try {
  //     const json = { begs: { prof: host } };
  //     const res = (await this.thread("beg", json)) as PeekRes;
  //     if (!("prof" in res)) return { error: "request error" };
  //     else return { ok: res.prof};
  //   } catch (e) {
  //     return { error: `${e}` };
  //   }
  // }
  // %noschat
  // scries
  async scryDMs(): AsyncRes<PeekDMInboxRes>{
    const path = `/j/dms`
    const res = await this.scry(path, "noschat");
    return res
  }
  async scryDM(ship: string): AsyncRes<PeekDMRes>{
    const path = `/j/dm/${ship}`
    const res = await this.scry(path, "noschat");
    return res
  }
  //  subs
  async subscribeDMs(handler: any){
    const path = "/ui";
    const res = await this.sub(path, handler, "noschat");
    return res
  }
  async subscribeDM(ship: string, handler: any){
    const path = `/dm/${ship}`;
    const res = await this.sub(path, handler, "noschat");
    return res
  }
  // pokes
  async addChat(peer: string, content: string){
    const json = { send: { content, peer} };
    return this.poke(  json , "noschat");
  }
  async muteChat(peer: string) {
    const json = { mute:  peer  };
    return this.poke(json, "noschat");
  }
  async unmuteChat(peer: string) {
    const json = { unmute:  peer  };
    return this.poke(json, "noschat");
  }
  async blockChat(peer: string) {
    const json = { block:  peer  };
    return this.poke(json, "noschat");
  }
  async unblockChat(peer: string) {
    const json = { unblock: peer  };
    return this.poke(json, "noschat");
  }
  async blockChatStrong(peer: string, msg: string) {
    const json = { gtfo :  {peer, msg}};
    return this.poke(json, "noschat");
  }
  async markChatRead(dm: DM){
    const id = dm.lastId!.toString();
    const peer = dm.peer.patp;
    const json = { read: { id, peer} };
    return this.poke( json , "noschat");
  }
  // requests
  async acceptReq(peer: string) {
    const json = { accept:  peer  };
    return this.poke(json, "noschat");
  }
  async rejectReq(peer: string) {
    const json = { reject:  peer  };
    return this.poke(json, "noschat");
  }

}
