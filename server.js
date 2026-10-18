// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var HOST = "0.0.0.0";
var CACHE_TTL_MS = 5 * 60 * 1e3;
var FETCH_TIMEOUT_MS = 15 * 1e3;
var MAX_BODY_SIZE = 5 * 1024 * 1024;
var cache = /* @__PURE__ */ new Map();
var inFlightRequests = /* @__PURE__ */ new Map();
var UpstreamError = class extends Error {
  constructor(message, status) {
    super(message);
    this.name = "UpstreamError";
    this.upstreamStatus = status;
  }
};
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase().trim();
  if (h === "localhost" || h === "::1" || h === "0.0.0.0" || h.endsWith(".local")) {
    return true;
  }
  const parts = h.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
    const [a, b, c, d] = parts.map(Number);
    if (a === 0 && b === 0 && c === 0 && d === 0) return true;
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}
function validateFeedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL kh\xF4ng h\u1EE3p l\u1EC7");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Giao th\u1EE9c URL kh\xF4ng h\u1EE3p l\u1EC7 (ch\u1EC9 h\u1ED7 tr\u1EE3 http v\xE0 https)");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("\u0110\u1ECBa ch\u1EC9 m\xE1y ch\u1EE7 kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p truy c\u1EADp");
  }
  return parsed;
}
async function fetchFeedFromUpstream(initialUrl) {
  let currentUrl = validateFeedUrl(initialUrl).toString();
  const maxRedirects = 5;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let sanitizeXmlEntities = function(xml) {
      const cdataMatches = [];
      const tokenized = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (match) => {
        cdataMatches.push(match);
        return `___CDATA_TOKEN_${cdataMatches.length - 1}___`;
      });
      const sanitized = tokenized.replace(
        /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,
        "&amp;"
      );
      return sanitized.replace(
        /___CDATA_TOKEN_(\d+)___/g,
        (_, index) => cdataMatches[Number(index)] || ""
      );
    };
    let response = null;
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, application/atom+xml;q=0.7, */*;q=0.5",
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.5"
        }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new UpstreamError(`B\xE1o tr\u1EA3 v\u1EC1 HTTP ${response.status} kh\xF4ng c\xF3 header Location`, response.status);
        }
        const nextUrl = new URL(location, currentUrl).toString();
        validateFeedUrl(nextUrl);
        currentUrl = nextUrl;
        continue;
      }
      break;
    }
    if (!response) {
      throw new Error("Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn m\xE1y ch\u1EE7 b\xE1o");
    }
    if (!response.ok) {
      throw new UpstreamError(`B\xE1o tr\u1EA3 v\u1EC1 HTTP ${response.status}`, response.status);
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      throw new Error("N\u1ED9i dung feed v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 5MB");
    }
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text, "utf-8") > MAX_BODY_SIZE) {
        throw new Error("N\u1ED9i dung feed v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 5MB");
      }
      return text;
    }
    const chunks = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_BODY_SIZE) {
          try {
            await reader.cancel();
          } catch {
          }
          throw new Error("N\u1ED9i dung feed v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 5MB");
        }
        chunks.push(value);
      }
    }
    const buffer = Buffer.concat(chunks);
    const decoder = new TextDecoder("utf-8");
    const rawXml = decoder.decode(buffer);
    return sanitizeXmlEntities(rawXml);
  } finally {
    clearTimeout(timeoutId);
  }
}
app.get("/api/feed", async (req, res) => {
  const feedUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!feedUrl) {
    return res.status(400).json({
      error: "Thi\u1EBFu tham s\u1ED1 url",
      upstreamStatus: null
    });
  }
  const cached = cache.get(feedUrl);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.send(cached.content);
  }
  let fetchPromise = inFlightRequests.get(feedUrl);
  if (!fetchPromise) {
    fetchPromise = fetchFeedFromUpstream(feedUrl).then((content) => {
      cache.set(feedUrl, {
        content,
        timestamp: Date.now()
      });
      return content;
    }).finally(() => {
      inFlightRequests.delete(feedUrl);
    });
    inFlightRequests.set(feedUrl, fetchPromise);
  }
  try {
    const xmlContent = await fetchPromise;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.send(xmlContent);
  } catch (err) {
    if (cached) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.send(cached.content);
    }
    if (err?.name === "AbortError") {
      return res.status(504).json({
        error: "B\xE1o ph\u1EA3n h\u1ED3i qu\xE1 ch\u1EADm (>15s)",
        upstreamStatus: 504
      });
    }
    if (err instanceof UpstreamError) {
      return res.status(502).json({
        error: err.message,
        upstreamStatus: err.upstreamStatus
      });
    }
    const msg = err?.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh khi t\u1EA3i feed";
    if (msg.includes("kh\xF4ng h\u1EE3p l\u1EC7") || msg.includes("kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p")) {
      return res.status(400).json({
        error: msg,
        upstreamStatus: null
      });
    }
    if (msg.includes("v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 5MB")) {
      return res.status(502).json({
        error: msg,
        upstreamStatus: null
      });
    }
    return res.status(502).json({
      error: msg,
      upstreamStatus: null
    });
  }
});
async function setupFrontend() {
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, HOST, () => {
    console.log(`Server L\u1EC1u B\xE1o \u0111ang l\u1EAFng nghe t\u1EA1i http://${HOST}:${PORT}`);
  });
}
setupFrontend().catch((err) => {
  console.error("L\u1ED7i kh\u1EDFi \u0111\u1ED9ng frontend:", err);
  process.exit(1);
});
