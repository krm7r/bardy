const ALLOWED_ORIGIN = "https://bardy.pages.dev";
const ALLOWED_PATHS = new Set(["web", "answers", "images", "videos", "news", "info"]);
const MAX_QUERY_LENGTH = 500;
const MAX_PAGE = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const requestCounts = new Map();
// Content filter. Terms are stored as one-way hashes of normalized whole words,
// so no listed term appears in this source. Matching is by whole word (not by
// substring), which avoids blocking innocent words such as city names.
const BLOCKED_HASHES = new Set([
  5912217812722458,
  6927323646146917,
  7627963825474724,
  4232131832333282,
  1397377425412071,
  798722756869965,
  6682571654302442,
  6176381438557104,
  919852066747451,
  5414484210100348,
  4120570015926373,
  3938996052474350,
  1663239089952460,
  5171047038256182,
  1802994843469075,
  7207919243553637,
  3472689217863387,
  3583076378290377,
  5729062255510931,
  1675770691794397,
  8620720931496316,
  2065073022299207,
  1923143487551965,
]);
const ARABIC_PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال", "و", "ب", "ل", "ف", "ك"];

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

// cyrb53: small, fast 53-bit string hash.
function hashWord(word) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < word.length; i++) {
    const ch = word.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function wordForms(word) {
  const forms = [word];
  for (const prefix of ARABIC_PREFIXES) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 2) forms.push(word.slice(prefix.length));
  }
  if (/^[a-z]{4,}s$/.test(word)) forms.push(word.slice(0, -1));
  return forms;
}

function collectText(value, out = [], depth = 0) {
  if (typeof value === "string") out.push(value);
  else if (depth < 6 && value && typeof value === "object") {
    for (const item of Object.values(value)) collectText(item, out, depth + 1);
  }
  return out;
}

function isAllowedOrigin(request, origin) {
  if (!origin) return false;
  return origin === ALLOWED_ORIGIN || origin === new URL(request.url).origin;
}

function headers(request, extra = {}) {
  const origin = request.headers.get("Origin");
  const result = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
  if (isAllowedOrigin(request, origin)) {
    result["Access-Control-Allow-Origin"] = origin;
    result.Vary = "Origin";
  }
  return result;
}

function isFrontendRequest(request) {
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer") || "";
  const fetchSite = request.headers.get("Sec-Fetch-Site") || "";
  if (isAllowedOrigin(request, origin)) return true;
  const ownOrigin = new URL(request.url).origin;
  const refererOk = referer.startsWith(`${ALLOWED_ORIGIN}/`) || referer.startsWith(`${ownOrigin}/`);
  return !origin && refererOk && (!fetchSite || fetchSite === "same-origin");
}

function json(request, value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: headers(request, extra),
  });
}

function clientKey(request) {
  return request.headers.get("CF-Connecting-IP") || "anonymous";
}

function isRateLimited(request) {
  const now = Date.now();
  if (requestCounts.size > 5000) {
    for (const [key, value] of requestCounts) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) requestCounts.delete(key);
    }
  }
  const key = clientKey(request);
  const current = requestCounts.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function isBlocked(value) {
  const words = normalizeText(collectText(value).join(" "))
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const forms = wordForms(words[i]);
    if (forms.some((form) => BLOCKED_HASHES.has(hashWord(form)))) return true;
    if (i + 1 < words.length && forms.some((form) => BLOCKED_HASHES.has(hashWord(`${form} ${words[i + 1]}`)))) return true;
  }
  return false;
}

function filterPayload(value) {
  if (Array.isArray(value)) return value.filter((item) => !isBlocked(item)).map(filterPayload);
  if (!value || typeof value !== "object") return value;
  const result = { ...value };
  for (const key of ["items", "results", "articles", "answers", "news", "data"]) {
    if (Array.isArray(result[key])) result[key] = filterPayload(result[key]);
    else if (result[key] && typeof result[key] === "object") result[key] = filterPayload(result[key]);
  }
  if (isBlocked(result.answer) || isBlocked(result.text)) {
    if ("answer" in result) result.answer = "";
    if ("text" in result) result.text = "";
    if ("description" in result) result.description = "";
  }
  return result;
}

function validateQuery(url, path) {
  const query = (url.searchParams.get("q") || "").trim();
  if (query.length > MAX_QUERY_LENGTH) return "Query is too long";
  if (!query && path !== "news") return "A search query is required";
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1),
  );
  return { query, page };
}

export async function onRequestOptions({ request }) {
  if (!isFrontendRequest(request)) return json(request, { success: false, error: "Frontend origin required" }, 403);
  return new Response(null, {
    status: 204,
    headers: headers(request, {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }),
  });
}

export async function onRequestGet({ request, env, params }) {
  if (!isFrontendRequest(request)) return json(request, { success: false, error: "Frontend origin required" }, 403);
  if (isRateLimited(request)) {
    return json(request, { success: false, error: "Too many requests" }, 429, { "Retry-After": "60" });
  }

  const url = new URL(request.url);
  const path = Array.isArray(params?.path) ? params.path.join("/").toLowerCase() : String(params?.path || "").toLowerCase();
  if (!ALLOWED_PATHS.has(path)) {
    return json(request, { success: false, error: "Invalid API path" }, 404);
  }

  const input = validateQuery(url, path);
  if (typeof input === "string") return json(request, { success: false, error: input }, 400);
  if (isBlocked(input.query)) return json(request, { success: true, type: path, query: input.query, page: input.page, page_size: 0, count: 0, has_more: false, items: [] });
  if (!env.LEEG_URL) {
    return json(request, { success: false, error: "Search service is not configured" }, 503);
  }

  const upstream = new URL(env.LEEG_URL);
  upstream.pathname = `${upstream.pathname.replace(/\/$/, "")}/${path}`;
  upstream.searchParams.set("q", input.query);
  upstream.searchParams.set("page", String(input.page));
  if (path === "news") {
    for (const key of ["category", "source"]) {
      const value = (url.searchParams.get(key) || "").trim();
      if (value.length <= 100) upstream.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(upstream, {
      method: "GET",
      headers: { Accept: "application/json", ...(env.LEEG_KEY ? { "X-Bardy-Key": env.LEEG_KEY } : {}) },
      cf: { cacheTtl: 300 },
    });
    const body = await response.text();
    let output = body;
    try {
      output = JSON.stringify(filterPayload(JSON.parse(body)));
    } catch {
      output = JSON.stringify({ success: false, error: "Invalid search service response" });
    }
    return new Response(output, {
      status: response.ok ? response.status : 502,
      headers: headers(request, {
        "Cache-Control": response.ok ? "public, max-age=300, s-maxage=300" : "no-store",
      }),
    });
  } catch (error) {
    console.error("worker_proxy_error", error instanceof Error ? error.message : String(error));
    return json(request, { success: false, error: "Search service is temporarily unavailable" }, 502);
  }
}

export async function onRequest({ request }) {
  return json(request, { success: false, error: "Method not allowed" }, 405, {
    Allow: "GET, OPTIONS",
  });
}
