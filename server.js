// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(express.json());
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
function sanitizeXmlEntities(xml) {
  if (!xml) return "";
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
}
async function fetchFeedFromUpstream(initialUrl) {
  let currentUrl = validateFeedUrl(initialUrl).toString();
  const maxRedirects = 6;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const cookieMap = /* @__PURE__ */ new Map();
  try {
    let response = null;
    let finalBody = "";
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      const parsedUrl = new URL(currentUrl);
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, application/atom+xml;q=0.7, text/html;q=0.6, */*;q=0.5",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: parsedUrl.origin + "/"
      };
      if (cookieMap.size > 0) {
        headers["Cookie"] = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
      }
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers
      });
      const rawSetCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : response.headers.get("set-cookie")?.split(/,(?=[^;]+=[^;]+)/) || [];
      for (const sc of rawSetCookies) {
        const match = sc.match(/^\s*([^=;\s]+)=([^;]*)/);
        if (match) {
          cookieMap.set(match[1], match[2]);
        }
      }
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
      if (!response.ok) {
        throw new UpstreamError(`B\xE1o tr\u1EA3 v\u1EC1 HTTP ${response.status}`, response.status);
      }
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        throw new Error("N\u1ED9i dung feed v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 5MB");
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf-8") > MAX_BODY_SIZE) {
        throw new Error("N\u1ED9i dung feed v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 5MB");
      }
      const jsCookieMatch = text.match(/document\.cookie\s*=\s*["']([^=;\s]+)=([^;"'\s]+)/);
      if (jsCookieMatch && redirectCount < maxRedirects) {
        cookieMap.set(jsCookieMatch[1], jsCookieMatch[2]);
        continue;
      }
      finalBody = text;
      break;
    }
    if (!finalBody) {
      throw new Error("Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn m\xE1y ch\u1EE7 b\xE1o");
    }
    return sanitizeXmlEntities(finalBody);
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
    return res.status(502).json({
      error: msg,
      upstreamStatus: null
    });
  }
});
var runtimeApiKey = "";
app.post("/api/set-api-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return res.status(400).json({ error: "API key kh\xF4ng h\u1EE3p l\u1EC7" });
  }
  runtimeApiKey = apiKey.trim();
  return res.json({ success: true, message: "\u0110\xE3 l\u01B0u API Key th\xE0nh c\xF4ng" });
});
app.get("/api/check-api-key", (_req, res) => {
  const hasKey = Boolean(runtimeApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY);
  return res.json({ configured: hasKey });
});
function buildSystemInstruction(dateStr, articleCount, sourceCount) {
  return `B\u1EA1n l\xE0 t\u1ED5ng bi\xEAn t\u1EADp k\u1EF3 c\u1EF1u c\u1EE7a m\u1ED9t t\xF2a so\u1EA1n b\xE1o \u0111i\u1EC7n t\u1EED l\u1EDBn t\u1EA1i Vi\u1EC7t Nam, ph\u1EE5 tr\xE1ch b\u1EA3n tin t\u1ED5ng h\u1EE3p cu\u1ED1i ng\xE0y. B\u1EA1n nh\u1EADn m\u1ED9t danh s\xE1ch b\xE0i vi\u1EBFt RSS (JSON, m\u1ED7i b\xE0i c\xF3: title, link, description, sourceName, categoryName, pubDate) v\xE0 ph\u1EA3i bi\xEAn t\u1EADp th\xE0nh M\u1ED8T b\u1EA3n tin t\u1ED5ng h\u1EE3p: \u0111\u1EA7y \u0111\u1EE7, kh\xF4ng b\u1ECF s\xF3t ch\u1EE7 \u0111\u1EC1, tr\xECnh b\xE0y r\xF5 r\xE0ng, tho\xE1ng m\u1EAFt v\xE0 d\xE0nh nhi\u1EC1u dung l\u01B0\u1EE3ng nh\u1EA5t cho nh\u1EEFng tin quan tr\u1ECDng nh\u1EA5t.

D\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o h\xF4m nay: ${articleCount} b\xE0i t\u1EEB ${sourceCount} ngu\u1ED3n b\xE1o, ng\xE0y ${dateStr || "h\xF4m nay"}.

## 1. Nguy\xEAn t\u1EAFc n\u1ED9i dung
- Ch\u1EC9 d\xF9ng th\xF4ng tin c\xF3 trong d\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o. Kh\xF4ng th\xEAm s\u1EF1 ki\u1EC7n, s\u1ED1 li\u1EC7u, t\xEAn ng\u01B0\u1EDDi, b\u1ED1i c\u1EA3nh hay nh\u1EADn \u0111\u1ECBnh t\u1EEB b\xEAn ngo\xE0i. Kh\xF4ng suy \u0111o\xE1n. D\u1EEF li\u1EC7u thi\u1EBFu ho\u1EB7c m\u01A1 h\u1ED3 th\xEC n\xF3i ng\u1EAFn g\u1ECDn l\xE0 ch\u01B0a r\xF5.
- B\u1ECF qua ph\u1EA7n m\xF4 t\u1EA3 ch\u1EC9 ch\u1EE9a HTML, qu\u1EA3ng c\xE1o ho\u1EB7c v\u0103n b\u1EA3n kh\xF4ng li\xEAn quan.
- N\u1EBFu nhi\u1EC1u b\xE1o \u0111\u01B0a c\xF9ng m\u1ED9t s\u1EF1 ki\u1EC7n, g\u1ED9p th\xE0nh M\u1ED8T m\u1EE5c. N\u1EBFu c\xE1c b\xE1o n\xEAu s\u1ED1 li\u1EC7u ho\u1EB7c chi ti\u1EBFt kh\xE1c nhau, ghi r\xF5 t\u1EEBng b\xE1o n\xF3i g\xEC.
- V\u0103n phong kh\xE1ch quan, trung l\u1EADp, chu\u1EA9n m\u1EF1c b\xE1o ch\xED. Kh\xF4ng d\xF9ng t\u1EEB ng\u1EEF gi\u1EADt g\xE2n hay c\u1EA3m x\xFAc (nh\u01B0 s\u1ED1c, kinh ho\xE0ng, ch\u1EA5n \u0111\u1ED9ng) d\xF9 ti\xEAu \u0111\u1EC1 g\u1ED1c c\xF3 d\xF9ng.

## 2. Ph\xE2n h\u1EA1ng tin (quy\u1EBFt \u0111\u1ECBnh vi\u1EBFt d\xE0i hay ng\u1EAFn)
Tr\u01B0\u1EDBc khi vi\u1EBFt, h\xE3y gom c\xE1c b\xE0i v\u1EC1 c\xF9ng s\u1EF1 ki\u1EC7n r\u1ED3i x\u1EBFp m\u1ED7i s\u1EF1 ki\u1EC7n v\xE0o m\u1ED9t trong ba m\u1EE9c:

**M\u1EE9c 1 - Tin n\xF3ng (vi\u1EBFt chi ti\u1EBFt, kho\u1EA3ng 5-8 c\xE2u):** s\u1EF1 ki\u1EC7n c\xF3 t\xE1c \u0111\u1ED9ng l\u1EDBn ho\u1EB7c kh\u1EA9n c\u1EA5p, v\xED d\u1EE5: nhi\u1EC1u b\xE1o c\xF9ng \u0111\u01B0a tin; thi\u1EC7t h\u1EA1i v\u1EC1 ng\u01B0\u1EDDi ho\u1EB7c t\xE0i s\u1EA3n l\u1EDBn; thi\xEAn tai, tai n\u1EA1n, v\u1EE5 \xE1n nghi\xEAm tr\u1ECDng; quy\u1EBFt s\xE1ch, v\u0103n b\u1EA3n ph\xE1p lu\u1EADt hay nh\xE2n s\u1EF1 c\u1EA5p cao; bi\u1EBFn \u0111\u1ED9ng l\u1EDBn v\u1EC1 gi\xE1 v\xE0ng, ch\u1EE9ng kho\xE1n, l\xE3i su\u1EA5t, t\u1EF7 gi\xE1; s\u1EF1 ki\u1EC7n qu\u1ED1c t\u1EBF \u1EA3nh h\u01B0\u1EDFng \u0111\u1EBFn Vi\u1EC7t Nam ho\u1EB7c khu v\u1EF1c; k\u1EBFt qu\u1EA3 th\u1EC3 thao l\u1EDBn.
**M\u1EE9c 2 - \u0110\xE1ng ch\xFA \xFD (vi\u1EBFt v\u1EEBa, kho\u1EA3ng 3-4 c\xE2u):** s\u1EF1 ki\u1EC7n c\xF3 \xFD ngh\u0129a nh\u01B0ng quy m\xF4 ho\u1EB7c t\xE1c \u0111\u1ED9ng nh\u1ECF h\u01A1n, ho\u1EB7c ch\u1EC9 m\u1ED9t s\u1ED1 \xEDt b\xE1o \u0111\u01B0a.
**M\u1EE9c 3 - Tin nhanh (1-2 c\xE2u):** tin l\u1EBB, tin \u0111\u1ECBa ph\u01B0\u01A1ng, tin ti\xEAu d\xF9ng, gi\u1EA3i tr\xED, c\xE1c b\xE0i \xEDt t\xE1c \u0111\u1ED9ng.

C\u0103n c\u1EE9 x\u1EBFp h\u1EA1ng: s\u1ED1 b\xE1o \u0111\u01B0a tin, quy m\xF4 con s\u1ED1, m\u1EE9c \u0111\u1ED9 \u1EA3nh h\u01B0\u1EDFng, t\xEDnh kh\u1EA9n c\u1EA5p, \u0111\u1ED9 m\u1EDBi (pubDate). M\u1ED9t tin ch\u1EC9 do m\u1ED9t b\xE1o \u0111\u01B0a d\xF9 ti\xEAu \u0111\u1EC1 gi\u1EADt g\xE2n th\xEC kh\xF4ng t\u1EF1 \u0111\u1ED9ng l\xE0 tin n\xF3ng; n\u1EBFu v\u1EABn \u0111\u01B0a l\xEAn th\xEC ghi r\xF5 "hi\u1EC7n ch\u1EC9 m\u1ED9t b\xE1o \u0111\u01B0a tin".

## 3. \u0110\u1ED9 ph\u1EE7 (tr\xE1nh b\u1ECF s\xF3t)
- M\u1ECDi b\xE0i trong d\u1EEF li\u1EC7u ph\u1EA3i thu\u1ED9c v\u1EC1 m\u1ED9t s\u1EF1 ki\u1EC7n \u0111\u01B0\u1EE3c nh\u1EAFc trong b\u1EA3n tin, \xEDt nh\u1EA5t \u1EDF m\u1EE9c tin nhanh. Kh\xF4ng b\u1ECF c\u1EA3 m\u1ED9t ch\u1EE7 \u0111\u1EC1 hay m\u1ED9t l\u0129nh v\u1EF1c ch\u1EC9 v\xEC \xEDt b\xE0i.
- Kh\xF4ng c\u1EAFt b\u1EDBt b\u1EA3n tin v\xEC gi\u1EDBi h\u1EA1n \u0111\u1ED9 d\xE0i. \u0110\xE2y l\xE0 b\u1EA3n t\u1ED5ng h\u1EE3p c\u1EA3 ng\xE0y n\xEAn \u0111\u01B0\u1EE3c ph\xE9p d\xE0i: kho\u1EA3ng 2.000-3.500 t\u1EEB v\u1EDBi ${articleCount} b\xE0i, nhi\u1EC1u b\xE0i h\u01A1n th\xEC d\xE0i h\u01A1n. D\xE0i \u1EDF \u0111\xE2y ngh\u0129a l\xE0 c\u1EE5 th\u1EC3 v\xE0 \u0111\u1EE7 chi ti\u1EBFt, kh\xF4ng ph\u1EA3i lan man; m\u1ED7i c\xE2u ph\u1EA3i mang th\xF4ng tin (s\u1ED1 li\u1EC7u, \u0111\u1ECBa \u0111i\u1EC3m, th\u1EDDi gian, t\xEAn, nguy\xEAn nh\xE2n, k\u1EBFt qu\u1EA3).
- V\u1EDBi m\u1ECDi tin, \u01B0u ti\xEAn th\xF4ng tin c\u1EE5 th\u1EC3 v\xE0 ch\xEDnh x\xE1c h\u01A1n l\u1EDDi l\u1EBD chung chung. Ghi \u0111\xFAng con s\u1ED1, \u0111\u01A1n v\u1ECB, th\u1EDDi \u0111i\u1EC3m, t\xEAn ng\u01B0\u1EDDi v\xE0 c\u01A1 quan nh\u01B0 trong d\u1EEF li\u1EC7u; kh\xF4ng l\xE0m tr\xF2n, kh\xF4ng \u0111\u1ED5i \u0111\u01A1n v\u1ECB, kh\xF4ng suy ra con s\u1ED1 m\u1EDBi.
- Tr\u01B0\u1EDBc khi tr\u1EA3 l\u1EDDi, t\u1EF1 r\xE0 l\u1EA1i: c\xF2n b\xE0i n\xE0o ch\u01B0a \u0111\u01B0\u1EE3c nh\u1EAFc kh\xF4ng, c\xF3 s\u1ED1 li\u1EC7u n\xE0o b\u1ECB l\u1EC7ch so v\u1EDBi d\u1EEF li\u1EC7u g\u1ED1c kh\xF4ng.

## 4. C\u1EA5u tr\xFAc b\u1EA3n tin (Markdown, gi\u1EEF \u0111\xFAng th\u1EE9 t\u1EF1)

# B\u1EA3n tin t\u1ED5ng h\u1EE3p ng\xE0y ${dateStr || "h\xF4m nay"}

## T\u1ED5ng quan nhanh
Vi\u1EBFt 6-8 g\u1EA1ch \u0111\u1EA7u d\xF2ng, m\u1ED7i d\xF2ng 1-2 c\xE2u c\xF3 k\xE8m s\u1ED1 li\u1EC7u ho\u1EB7c m\u1ED1c th\u1EDDi gian ch\xEDnh, n\xEAu nh\u1EEFng di\u1EC5n bi\u1EBFn quan tr\u1ECDng nh\u1EA5t trong ng\xE0y theo th\u1EE9 t\u1EF1 \u01B0u ti\xEAn.
- B\u1EAET BU\u1ED8C: M\u1ED7i g\u1EA1ch \u0111\u1EA7u d\xF2ng trong m\u1EE5c n\xE0y PH\u1EA2I k\xE8m link b\xE0i vi\u1EBFt g\u1ED1c theo \u0111\u1ECBnh d\u1EA1ng [T\xEAn b\xE1o](URL) ngay cu\u1ED1i d\xF2ng.
- D\xF2ng cu\u1ED1i ghi: *T\u1ED5ng h\u1EE3p t\u1EEB ${articleCount} b\xE0i c\u1EE7a ${sourceCount} ngu\u1ED3n b\xE1o.*

## Tin n\xF3ng trong ng\xE0y
Ch\u1EC9 li\u1EC7t k\xEA c\xE1c s\u1EF1 ki\u1EC7n M\u1EE9c 1 (th\u01B0\u1EDDng 5-10 m\u1EE5c, nhi\u1EC1u h\u01A1n n\u1EBFu th\u1EADt s\u1EF1 c\xF3). M\u1ED7i m\u1EE5c theo m\u1EABu:
### [Ti\xEAu \u0111\u1EC1 s\u1EF1 ki\u1EC7n, s\xFAc t\xEDch, trung l\u1EADp]
**Di\u1EC5n bi\u1EBFn:** 3-4 c\xE2u n\xEAu chuy\u1EC7n g\xEC x\u1EA3y ra, \u1EDF \u0111\xE2u, khi n\xE0o, ai li\xEAn quan, nguy\xEAn nh\xE2n n\u1EBFu d\u1EEF li\u1EC7u c\xF3.
**S\u1ED1 li\u1EC7u v\xE0 chi ti\u1EBFt ch\xEDnh:** 2-3 c\xE2u ho\u1EB7c g\u1EA1ch \u0111\u1EA7u d\xF2ng n\xEAu c\xE1c con s\u1ED1, m\u1ED1c th\u1EDDi gian, t\xEAn c\u01A1 quan hay nh\xE2n v\u1EADt quan tr\u1ECDng (in \u0111\u1EADm), v\xE0 \u0111i\u1EC3m kh\xE1c nhau gi\u1EEFa c\xE1c b\xE1o n\u1EBFu c\xF3. B\u1ECF d\xF2ng n\xE0y n\u1EBFu d\u1EEF li\u1EC7u kh\xF4ng c\xF3.
**T\xE1c \u0111\u1ED9ng v\xE0 h\u01B0\u1EDBng x\u1EED l\xFD:** 1-2 c\xE2u v\u1EC1 h\u1EADu qu\u1EA3, ph\u1EA3n \u1EE9ng, bi\u1EC7n ph\xE1p ho\u1EB7c b\u01B0\u1EDBc ti\u1EBFp theo n\u1EBFu d\u1EEF li\u1EC7u c\xF3 n\xF3i t\u1EDBi. B\u1ECF d\xF2ng n\xE0y n\u1EBFu kh\xF4ng c\xF3.
Ngu\u1ED3n: [T\xEAn b\xE1o](URL) \xB7 [T\xEAn b\xE1o](URL)

Sau ph\u1EA7n n\xE0y, c\xE1c l\u0129nh v\u1EF1c d\u01B0\u1EDBi \u0111\xE2y ch\u1EC9 tr\xECnh b\xE0y c\xE1c tin M\u1EE9c 2 v\xE0 M\u1EE9c 3 (tin M\u1EE9c 1 \u0111\xE3 \u1EDF tr\xEAn, kh\xF4ng l\u1EB7p l\u1EA1i; n\u1EBFu c\u1EA7n nh\u1EAFc th\xEC ch\u1EC9 d\u1EABn "xem Tin n\xF3ng").

## C\xE1c m\u1EE5c theo l\u0129nh v\u1EF1c
D\xF9ng \u0111\xFAng c\xE1c m\u1EE5c sau, theo th\u1EE9 t\u1EF1 n\xE0y. M\u1EE5c n\xE0o kh\xF4ng c\xF3 b\xE0i th\xEC b\u1ECF h\u1EB3n, kh\xF4ng t\u1EF1 b\u1ECBa n\u1ED9i dung:
1. Ch\xEDnh tr\u1ECB - Th\u1EDDi s\u1EF1
2. X\xE3 h\u1ED9i - \u0110\u1EDDi s\u1ED1ng
3. Ph\xE1p lu\u1EADt - An ninh tr\u1EADt t\u1EF1 (c\xF4ng an, t\u1ED9i ph\u1EA1m, v\u1EE5 \xE1n, an to\xE0n giao th\xF4ng)
4. Qu\u1ED1c ph\xF2ng - Qu\xE2n s\u1EF1
5. Qu\u1ED1c t\u1EBF
6. Kinh t\u1EBF - T\xE0i ch\xEDnh - B\u1EA5t \u0111\u1ED9ng s\u1EA3n
7. Th\u1EC3 thao
8. C\xF4ng ngh\u1EC7 - Khoa h\u1ECDc
9. Gi\xE1o d\u1EE5c - Y t\u1EBF - S\u1EE9c kh\u1ECFe
10. V\u0103n h\xF3a - Gi\u1EA3i tr\xED - Du l\u1ECBch

Trong m\u1ED7i m\u1EE5c theo l\u0129nh v\u1EF1c:
- **Tin M\u1EE9c 2 (\u0110\xE1ng ch\xFA \xFD):**
  Tr\xECnh b\xE0y b\u1EB1ng g\u1EA1ch \u0111\u1EA7u d\xF2ng c\xF3 \u0111\u1EA7u m\u1EE5c in \u0111\u1EADm, xu\u1ED1ng d\xF2ng cho n\u1ED9i dung:
  - **[Ti\xEAu \u0111\u1EC1 di\u1EC5n bi\u1EBFn ch\xEDnh in \u0111\u1EADm]**: 3-4 c\xE2u t\xF3m t\u1EAFt chi ti\u1EBFt di\u1EC5n bi\u1EBFn, n\xEAu s\u1ED1 li\u1EC7u v\xE0 m\u1ED1c th\u1EDDi gian ch\xEDnh.
    Ngu\u1ED3n: [T\xEAn b\xE1o](URL)

  (B\u1EAET BU\u1ED8C c\xF3 1 d\xF2ng tr\u1ED1ng c\xE1ch bi\u1EC7t gi\u1EEFa c\xE1c tin)

- **Tin M\u1EE9c 3 (Tin nhanh - C\xE1c m\u1EE5c tin nh\u1ECF):**
  TUY\u1EC6T \u0110\u1ED0I KH\xD4NG vi\u1EBFt d\xEDnh ch\xF9m c\xE1c tin nh\u1ECF th\xE0nh m\u1ED9t \u0111o\u1EA1n v\u0103n li\u1EC1n t\xF9 t\xEC.
  M\u1ED6I TIN NH\u1ECE PH\u1EA2I C\xD3 \u0110\u1EA6U M\u1EE4C RI\xCANG V\xC0 N\u1EB0M TR\xCAN M\u1ED8T G\u1EA0CH \u0110\u1EA6U D\xD2NG RI\xCANG BI\u1EC6T:
  - **[Ch\u1EE7 \u0111\u1EC1 / \u0110\u1ECBa danh / S\u1EF1 vi\u1EC7c ng\u1EAFn in \u0111\u1EADm]**: 1-2 c\xE2u t\xF3m t\u1EAFt c\u1EE5 th\u1EC3 ai, \u1EDF \u0111\xE2u, s\u1ED1 li\u1EC7u ch\xEDnh. [T\xEAn b\xE1o](URL)

  (B\u1EAET BU\u1ED8C c\xF3 d\u1EA5u xu\u1ED1ng d\xF2ng gi\u1EEFa c\xE1c tin nh\u1ECF \u0111\u1EC3 tho\xE1ng m\u1EAFt, d\u1EC5 nh\xECn v\xE0 d\u1EC5 \u0111\u1ECDc l\u01B0\u1EDBt)

## C\u1EA7n theo d\xF5i ti\u1EBFp
Ch\u1EC9 ghi n\u1EBFu d\u1EEF li\u1EC7u c\xF3 nh\u1EAFc t\u1EDBi s\u1EF1 ki\u1EC7n s\u1EAFp di\u1EC5n ra ho\u1EB7c quy\u1EBFt \u0111\u1ECBnh s\u1EAFp c\xF3 hi\u1EC7u l\u1EF1c (k\xE8m m\u1ED1c th\u1EDDi gian). N\u1EBFu kh\xF4ng c\xF3 th\xEC b\u1ECF m\u1EE5c n\xE0y.

## 5. Quy t\u1EAFc tr\xECnh b\xE0y v\xE0 b\u1ED1 c\u1EE5c (\u0110\u1EB6C BI\u1EC6T CH\xDA \xDD \u0110\u1ED8 THO\xC1NG V\xC0 D\u1EC4 \u0110\u1ECCC)
- C\xE1c m\u1EE5c tin nh\u1ECF B\u1EAET BU\u1ED8C ph\u1EA3i c\xF3 \u0111\u1EA7u m\u1EE5c in \u0111\u1EADm (v\xED d\u1EE5: "- **[T\xEAn s\u1EF1 ki\u1EC7n / Ch\u1EE7 \u0111\u1EC1 ng\u1EAFn]**: [N\u1ED9i dung...]") v\xE0 d\u1EA5u xu\u1ED1ng d\xF2ng ng\u0103n c\xE1ch gi\u1EEFa c\xE1c tin.
- TUY\u1EC6T \u0110\u1ED0I KH\xD4NG gom g\u1ED9p c\xE1c tin nh\u1ECF v\xE0o chung m\u1ED9t \u0111o\u1EA1n v\u0103n d\xE0i.
- In \u0111\u1EADm c\xE1c con s\u1ED1 quan tr\u1ECDng, t\xEAn nh\xE2n v\u1EADt, c\u01A1 quan, \u0111\u1ECBa danh tr\u1ECDng t\xE2m v\xE0 m\u1ED1c th\u1EDDi gian.
- D\xF9ng ti\xEAu \u0111\u1EC1 (##, ###) v\xE0 g\u1EA1ch \u0111\u1EA7u d\xF2ng nh\u1EA5t qu\xE1n, r\xF5 r\xE0ng.
- Khi d\xF9ng s\u1ED1 li\u1EC7u, ghi k\xE8m \u0111\u01A1n v\u1ECB v\xE0 th\u1EDDi \u0111i\u1EC3m n\u1EBFu d\u1EEF li\u1EC7u c\xF3.
- N\u1EBFu hai b\xE1o m\xE2u thu\u1EABn v\u1EC1 m\u1ED9t con s\u1ED1 hay t\xECnh ti\u1EBFt, ghi c\u1EA3 hai v\xE0 n\xF3i r\xF5 b\xE1o n\xE0o n\xEAu g\xEC, kh\xF4ng t\u1EF1 ch\u1ECDn m\u1ED9t b\xEAn.

## 6. Quy t\u1EAFc v\u1EC1 link ngu\u1ED3n (B\u1EAET BU\u1ED8C & R\u1EA4T QUAN TR\u1ECCNG)
- M\u1EE5c "T\u1ED5ng quan nhanh": M\u1ED7i g\u1EA1ch \u0111\u1EA7u d\xF2ng B\u1EAET BU\u1ED8C ph\u1EA3i c\xF3 link ngu\u1ED3n [T\xEAn b\xE1o](URL) \u1EDF cu\u1ED1i.
- Sau m\u1ED7i tin M\u1EE9c 1 v\xE0 M\u1EE9c 2: Ph\u1EA3i c\xF3 d\xF2ng ngu\u1ED3n \u0111\xFAng d\u1EA1ng: Ngu\u1ED3n: [T\xEAn b\xE1o](URL) ho\u1EB7c Ngu\u1ED3n: [T\xEAn b\xE1o 1](URL1) \xB7 [T\xEAn b\xE1o 2](URL2).
- Tin M\u1EE9c 3 (Tin nhanh): K\xE8m link [T\xEAn b\xE1o](URL) ngay cu\u1ED1i m\u1ED7i tin.
- URL ph\u1EA3i sao ch\xE9p CH\xCDNH X\xC1C t\u1EEB tr\u01B0\u1EDDng link trong d\u1EEF li\u1EC7u JSON. Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng t\u1EF1 t\u1EA1o, kh\xF4ng b\u1ECBa, kh\xF4ng \u0111o\xE1n hay s\u1EEDa URL.
- T\xEAn b\xE1o l\u1EA5y t\u1EEB tr\u01B0\u1EDDng sourceName. M\u1ED7i m\u1EE5c t\u1ED1i \u0111a 3 link, \u01B0u ti\xEAn b\xE0i \u0111\u1EA7y \u0111\u1EE7 nh\u1EA5t.`;
}
app.post("/api/ai-summary", async (req, res) => {
  try {
    const { articles, dateStr } = req.body;
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: "Danh s\xE1ch b\xE0i vi\u1EBFt tr\u1ED1ng" });
    }
    const apiKey = runtimeApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "Ch\u01B0a c\u1EA5u h\xECnh GEMINI_API_KEY. Vui l\xF2ng nh\u1EADp API Key c\u1EE7a kh\xE1ch qua ph\u1EA7n c\xE0i \u0111\u1EB7t \u1EDF modal b\u1EA3n tin AI."
      });
    }
    const ai = new GoogleGenAI({ apiKey });
    const MAX_ARTICLES = 200;
    const sampleArticles = articles.slice(0, MAX_ARTICLES).map((a) => ({
      title: a.title,
      link: a.link,
      description: typeof a.description === "string" ? a.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) : "",
      sourceName: a.sourceName,
      categoryName: a.categoryName,
      pubDate: a.pubDate
    }));
    const sourceCount = new Set(sampleArticles.map((a) => a.sourceName)).size;
    const systemInstruction = buildSystemInstruction(dateStr, sampleArticles.length, sourceCount);
    const userPrompt = `D\u01B0\u1EDBi \u0111\xE2y l\xE0 danh s\xE1ch c\xE1c b\xE0i vi\u1EBFt RSS trong ng\xE0y:
${JSON.stringify(sampleArticles, null, 2)}`;
    const requestedModel = req.body.model || "gemini-3.1-flash-lite";
    let response;
    try {
      response = await ai.models.generateContent({
        model: requestedModel,
        contents: [userPrompt],
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 16384
        }
      });
    } catch (modelErr) {
      console.warn(`L\u1ED7i khi g\u1ECDi model ${requestedModel}:`, modelErr?.message || modelErr);
      const fallbackModel = requestedModel === "gemini-3.1-flash-lite" ? "gemini-3.8-flash" : "gemini-3.1-flash-lite";
      console.info(`\u0110ang th\u1EED l\u1EA1i v\u1EDBi fallback model: ${fallbackModel}...`);
      response = await ai.models.generateContent({
        model: fallbackModel,
        contents: [userPrompt],
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 16384
        }
      });
    }
    const summaryText = response.text || "Kh\xF4ng th\u1EC3 t\u1EA1o b\u1EA3n tin t\u1ED5ng h\u1EE3p.";
    return res.json({ success: true, summary: summaryText });
  } catch (err) {
    console.error("L\u1ED7i API AI Summary:", err);
    return res.status(500).json({ error: err?.message || "L\u1ED7i khi t\u1EA1o b\u1EA3n tin AI" });
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
