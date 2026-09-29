// a fake NWC wallet service (NIP-47) on a public relay, for testing
// %trill-wallet's client end to end: real relay, real NIP-44 (nostr-tools),
// fake Lightning. prints a connection uri, then answers requests:
//   get_balance, make_invoice (paid 6 s later), lookup_invoice, pay_invoice
// run from ui/: bun tests/wallet/nwc-mock.js   (RELAY=wss://... to change relay)
// see WALLET.md, "Testing"
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { Relay } from "nostr-tools/relay";

const RELAY = process.env.RELAY ?? "wss://nos.lol";
const hex = (b) => Buffer.from(b).toString("hex");
const sk = generateSecretKey();
const pk = getPublicKey(sk);
const clientSk = generateSecretKey();
const clientPk = getPublicKey(clientSk);
const ck = nip44.v2.utils.getConversationKey(sk, clientPk);
const now = () => Math.floor(Date.now() / 1000);

let balance = 21_000_000; // msats
const invoices = new Map(); // payment_hash -> { invoice, amount, created, settled }

const relay = await Relay.connect(RELAY);
await relay.publish(
  finalizeEvent(
    {
      kind: 13194,
      created_at: now(),
      content: "pay_invoice get_balance make_invoice lookup_invoice",
      tags: [["encryption", "nip44_v2"]],
    },
    sk,
  ),
);
console.log(
  `URI nostr+walletconnect://${pk}?relay=${encodeURIComponent(RELAY)}&secret=${hex(clientSk)}&lud16=mock%40example.com`,
);

function answer(req, result_type, result, error = null) {
  const content = nip44.v2.encrypt(JSON.stringify({ result_type, error, result }), ck);
  const ev = finalizeEvent(
    { kind: 23195, created_at: now(), content, tags: [["p", clientPk], ["e", req.id]] },
    sk,
  );
  relay.publish(ev).then(
    () => console.log("answered", result_type, error ? error.code : "ok"),
    (e) => console.log("publish failed", e),
  );
}

relay.subscribe([{ kinds: [23194], "#p": [pk], since: now() - 5 }], {
  onevent(ev) {
    if (!verifyEvent(ev) || ev.pubkey !== clientPk) return console.log("ignored", ev.id);
    let body;
    try {
      body = JSON.parse(nip44.v2.decrypt(ev.content, ck));
    } catch (e) {
      return console.log("undecryptable", e.message);
    }
    console.log("request", body.method, JSON.stringify(body.params));
    const p = body.params ?? {};
    switch (body.method) {
      case "get_balance":
        return answer(ev, "get_balance", { balance });
      case "make_invoice": {
        const hash = hex(crypto.getRandomValues(new Uint8Array(32)));
        const sats = Math.floor(p.amount / 1000);
        const invoice = `lnbc${sats * 10}n1pmock${hash.slice(0, 20)}`;
        invoices.set(hash, { invoice, amount: p.amount, created: now(), settled: null });
        setTimeout(() => {
          invoices.get(hash).settled = now();
          balance += p.amount;
          console.log("invoice paid", sats, "sats");
        }, 6000);
        return answer(ev, "make_invoice", {
          type: "incoming", state: "pending", invoice, payment_hash: hash,
          amount: p.amount, created_at: now(), expires_at: now() + 3600,
        });
      }
      case "lookup_invoice": {
        const i = invoices.get(p.payment_hash);
        if (!i) return answer(ev, "lookup_invoice", null, { code: "NOT_FOUND", message: "no such invoice" });
        return answer(ev, "lookup_invoice", {
          type: "incoming", state: i.settled ? "settled" : "pending", invoice: i.invoice,
          payment_hash: p.payment_hash, amount: i.amount, created_at: i.created,
          ...(i.settled ? { settled_at: i.settled } : {}),
        });
      }
      case "pay_invoice": {
        const m = /^lnbc(\d+)([munp]?)1/.exec(p.invoice ?? "");
        const mult = { m: 1e8, u: 1e5, n: 100, p: 0.1, "": 1e11 };
        const msats = m ? Number(m[1]) * mult[m[2]] : 0;
        if (msats + 1000 > balance)
          return answer(ev, "pay_invoice", null, { code: "INSUFFICIENT_BALANCE", message: "not enough sats" });
        balance -= msats + 1000;
        return answer(ev, "pay_invoice", { preimage: hex(crypto.getRandomValues(new Uint8Array(32))), fees_paid: 1000 });
      }
      default:
        return answer(ev, body.method, null, { code: "NOT_IMPLEMENTED", message: body.method });
    }
  },
});
setTimeout(() => process.exit(0), 20 * 60 * 1000);
