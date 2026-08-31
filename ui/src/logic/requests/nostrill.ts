import type Urbit from "urbit-api";
import type { Cursor, Gate, PostID, PostPerms } from "@/types/trill";
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
  private async poke(json: any, agent?: string, marc?: string) {
    const app = agent ? agent : "nostrill";
    const mark = marc ? marc : "json";
    try {
      const res = await this.airlock.poke({
        app,
        mark,
        json,
      });
      return { ok: res };
    } catch (e) {
      return { error: `${e}` };
    }
  }
  private async scry(path: string, agent?: string) {
    try {
      const app = agent ? agent : "nostrill";
      console.log("scrying", {app, path})
      const res = await this.airlock.scry({ app, path });
      return { ok: res };
    } catch (e) {
      return { error: `${e}` };
    }
  }
  private async sub(path: string, handler: Handler, agent?: string) {
    const has = this.subs.get(path);
    if (has) return;

    const err = (err: any, _id: string) =>
      console.error(err, "error on nostrill subscription");
    const quit = (data: any) => {
      console.error(data, "nostrill subscription kicked");
      this.subs.delete(path);
    };
    const app = agent ? agent : "nostrill";
    const res = await this.airlock.subscribe({
      app,
      path,
      event: handler,
      err,
      quit,
    });
    this.subs.set(path, res);
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
    return { ok: r.thread };
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
    const json = { reply: { content, host, id, thread } };
    return this.poke({ post: json });
  }
  async addQuote(content: string, host: UserType, id: string) {
    const json = { quote: { content, host, id } };
    return this.poke({ post: json });
  }
  async addRP(host: UserType, id: string) {
    const json = { rp: { host, id } };
    return this.poke({ post: json });
  }

  // async addPost(post: SentPoast, gossip: boolean) {
  //   const json = {
  //     "new-post": {
  //       "sent-post": post,
  //       gossip,
  //     },
  //   };
  //   return this.poke(json);
  // }

  async deletePost(host: UserType, id: string) {
    const json = {
      del: {
        host,
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
        host,
      },
    };

    return this.poke({ post: json });
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
    const json = { add: user };
    return this.poke({ fols: json });
  }

  async unfollow(user: UserType) {
    const json = { del: user };
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
    const json = { fetch: users };
    return await this.poke({ prof: json });
  }
  async scryProfile(user?: UserType): AsyncRes<UserProfile> {
    const path = user
      ? `/j/profile/${Object.keys(user)[0]}/${Object.values(user)[0]}`
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
      else return { ok: res.thread };
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
    console.log("sending poke...", json)
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
