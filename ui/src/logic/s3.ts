import type { S3Config, S3ServerConfig } from "@/types/urbit";
import { S3Client } from "@bradenmacdonald/s3-lite-client";
import { URL as SHIP_URL } from "@/logic/api";

const BUCKET = "trill";

export function jarsConfig(raw: S3ServerConfig): S3Config {
  if (!raw || typeof raw.region !== "string" || !raw.region || typeof raw.accessKeyId !== "string" || !raw.accessKeyId) {
    throw new Error("The media server configuration is incomplete.");
  }
  const endpoint = new URL(`${SHIP_URL}/jars`, window.location.origin).href;
  const secretAccessKey = typeof raw.secretAccessKey === "string" ? raw.secretAccessKey : undefined;
  // A config without a secret can use the Eyre session on the ship origin.
  // Wildcard CORS disallows cookies across origins, so development needs
  // signing credentials.
  if (!secretAccessKey && new URL(endpoint).origin !== window.location.origin) {
    throw new Error("The media server configuration is incomplete.");
  }
  return { endpoint, currentBucket: BUCKET, region: raw.region, accessKeyId: raw.accessKeyId, secretAccessKey };
}

export function mediaUrl(config: S3Config, key: string): string {
  return `${config.endpoint}/${config.currentBucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function request(
  config: S3Config,
  method: "GET" | "HEAD" | "PUT",
  key = "",
  payload?: Uint8Array,
  headers?: Headers,
  signal?: AbortSignal,
) {
  let url = mediaUrl(config, key);
  if (config.secretAccessKey) {
    const endpoint = new URL(config.endpoint);
    const [bucket, ...prefix] = endpoint.pathname.split("/").filter(Boolean);
    // Treat the Eyre prefix as the signing bucket and trill/... as its key.
    // This signs the correct /jars/trill path while avoiding the client's
    // empty-object-name restriction on presigned bucket requests.
    const client = new S3Client({
      endPoint: endpoint.origin,
      bucket,
      region: config.region,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
      pathStyle: true,
    });
    url = await client.getPresignedUrl(method, [...prefix, config.currentBucket, key].filter(Boolean).join("/"), { expirySeconds: 60 });
  }
  // Sign for the ship, then transport through Vite in development. The proxy
  // restores the signed host/path, avoiding Eyre + Jars duplicate CORS headers.
  // Public media URLs still point straight to the ship.
  if (import.meta.env.DEV) {
    const proxied = new URL(url);
    proxied.pathname = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${proxied.pathname}`;
    url = `${window.location.origin}${proxied.pathname}${proxied.search}`;
  }
  const response = await fetch(url, {
    method, body: payload, headers,
    credentials: config.secretAccessKey ? "omit" : "same-origin",
    signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw Object.assign(new Error(`Media request failed (${response.status})`), { statusCode: response.status });
  return response;
}

export async function ensureMediaBucket(config: S3Config): Promise<void> {
  try {
    const response = await request(config, "HEAD");
    await response.arrayBuffer();
  } catch (error) {
    // Only an absent bucket permits creation; auth/server/network errors must
    // not be mistaken for absence. Jars creation itself is idempotent.
    if (!(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)) throw error;
    const response = await request(config, "PUT");
    await response.arrayBuffer();
  }
}

export async function listMedia(config: S3Config, signal: AbortSignal) {
  // Jars supports max-keys but no continuation tokens. Read its actual XML
  // contract rather than the S3 client's automatic v2 pagination loop.
  const response = await request(config, "GET", "", undefined, undefined, signal);
  const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
  signal.throwIfAborted();
  if (xml.querySelector("parsererror") || xml.documentElement.localName !== "ListBucketResult") throw new Error("Invalid media listing");
  const keys = new Set([...xml.getElementsByTagNameNS("*", "Contents")].map(item => item.getElementsByTagNameNS("*", "Key")[0]?.textContent ?? "").filter(Boolean));
  return { keys: [...keys], limited: xml.getElementsByTagNameNS("*", "IsTruncated")[0]?.textContent === "true" };
}

export async function uploadToS3(file: File, config: S3Config, signal?: AbortSignal): Promise<string> {
  const extension = file.name.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase();
  const key = `${Date.now()}-${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const payload = new Uint8Array(await file.arrayBuffer());
  // Content-Type belongs on the object itself, not x-amz-meta-content-type.
  const headers = new Headers({ "content-type": file.type || "application/octet-stream" });
  const response = await request(config, "PUT", key, payload, headers, signal);
  await response.arrayBuffer();
  return mediaUrl(config, key);
}
