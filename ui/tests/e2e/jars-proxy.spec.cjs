const { test, expect } = require("./playwright-runtime.cjs");
const http = require("node:http");
const crypto = require("node:crypto");
const path = require("node:path");

// Browser -> real Vite proxy -> local HTTP fixture. Failure cases: duplicate
// CORS headers, missing bucket status hidden from JS, rewritten signature host
// or path, lost upload body/MIME, and proxy URLs leaking into published media.
test("Jars dev proxy handles duplicate CORS headers and preserves valid signed requests", async ({ page }, testInfo) => {
  const secret = "public-proxy-fixture-secret";
  const requests = [];
  let exists = false;
  const hmac = (key, value) => crypto.createHmac("sha256", key).update(value).digest();
  const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const upstream = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const signature = url.searchParams.get("X-Amz-Signature");
    const credential = (url.searchParams.get("X-Amz-Credential") || "").split("/");
    const [, date, region, service, terminator] = credential;
    url.searchParams.delete("X-Amz-Signature");
    const query = [...url.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
    const canonical = `${req.method}\n${url.pathname}\n${query}\nhost:${req.headers.host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const scope = `${date}/${region}/${service}/${terminator}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, date || ""), region || ""), service || ""), terminator || "");
    const stringToSign = `AWS4-HMAC-SHA256\n${url.searchParams.get("X-Amz-Date")}\n${scope}\n${crypto.createHash("sha256").update(canonical).digest("hex")}`;
    const valid = hmac(signingKey, stringToSign).toString("hex") === signature;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    requests.push({ method: req.method, path: url.pathname, valid, type: req.headers["content-type"], body: body.toString() });
    // Reproduce Eyre + Jars' duplicate headers, rather than normalizing them.
    res.setHeader("Access-Control-Allow-Origin", ["http://localhost:5173", "*"]);
    if (!valid) { res.writeHead(403); res.end(); return; }
    const bucket = /^\/jars\/trill\/?$/.test(url.pathname);
    if (req.method === "HEAD") { res.writeHead(exists ? 200 : 404); res.end(); return; }
    if (req.method === "PUT") { if (bucket) exists = true; res.writeHead(200); res.end(); return; }
    res.setHeader("Content-Type", "application/xml");
    res.end('<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>sample.png</Key></Contents></ListBucketResult>');
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  let vite;
  try {
    const { createServer } = await import("vite");
    vite = await createServer({
      configFile: path.resolve(__dirname, "../../vite.config.ts"),
      logLevel: "silent",
      server: { host: "127.0.0.1", port: 0, hmr: false, proxy: { "/apps/nostrill/jars": { target: origin } } },
    });
    await vite.listen();
    const frontend = `http://127.0.0.1:${vite.httpServer.address().port}`;
    await page.route(`${frontend}/apps/nostrill/proxy-check`, route => route.fulfill({ contentType: "text/html", body: '<html><body><h1>Jars proxy verification</h1><pre id="result"></pre></body></html>' }));
    await page.goto(`${frontend}/apps/nostrill/proxy-check`);
    const result = await page.evaluate(async ({ origin, secret }) => {
      const { ensureMediaBucket, listMedia, uploadToS3 } = await import("/apps/nostrill/src/logic/s3.ts");
      const config = { endpoint: `${origin}/jars`, currentBucket: "trill", region: "us-east-1", accessKeyId: "fixture", secretAccessKey: secret };
      await ensureMediaBucket(config);
      const listing = await listMedia(config, new AbortController().signal);
      const uploaded = await uploadToS3(new File(["fixture image bytes"], "test.png", { type: "image/png" }), config);
      const result = { keys: listing.keys, uploaded, ready: true };
      document.querySelector("#result").textContent = JSON.stringify({ keys: listing.keys, ready: true, publicUrlHasSignature: uploaded.includes("X-Amz-") }, null, 2);
      return result;
    }, { origin, secret });
    expect(result.keys).toEqual(["sample.png"]);
    expect(result.uploaded).toMatch(new RegExp(`^${origin}/jars/trill/.+\\.png$`));
    expect(requests.map(request => request.method)).toEqual(["HEAD", "PUT", "GET", "PUT"]);
    expect(requests.every(request => request.valid)).toBe(true);
    expect(requests.at(-1)).toMatchObject({ type: "image/png", body: "fixture image bytes" });
    await page.screenshot({ path: testInfo.outputPath("jars-proxy-success.png") });
    await testInfo.attach("proxy-requests", { body: JSON.stringify(requests, null, 2), contentType: "application/json" });
  } finally {
    await vite?.close();
    await new Promise(resolve => upstream.close(resolve));
  }
});
