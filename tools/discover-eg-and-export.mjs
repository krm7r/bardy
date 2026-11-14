import fs from "node:fs/promises";

const maxUrls = Math.min(Number(process.env.MAX_URLS || 1000), 10000);
const timeoutMs = 12000;
const userAgent = "BardyDiscovery/0.2 (+https://bardy.pages.dev/)";

function validEgUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.endsWith(".eg") && host !== "eg") return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function textFromHtml(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function match(html, pattern) {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function metadata(html, url) {
  const title = textFromHtml(match(html, /<title[^>]*>([\s\S]*?)<\/title>/i)).slice(0, 300) || new URL(url).hostname;
  const description = textFromHtml(match(html, /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i)).slice(0, 500);
  const image = match(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
  const base = new URL(url);
  return {
    title,
    url,
    description,
    domain: base.hostname,
    icon_url: new URL("/favicon.ico", base).href,
    image_url: image ? new URL(image, base).href : "",
    source: "common-crawl-index",
    indexed_at: new Date().toISOString()
  };
}

async function latestIndex() {
  const response = await fetch("https://index.commoncrawl.org/collinfo.json", { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Common Crawl collections HTTP ${response.status}`);
  const collections = await response.json();
  const current = collections.find((item) => item.id.startsWith("CC-MAIN-2026")) || collections[0];
  return current["cdx-api"];
}

const indexUrl = await latestIndex();
const query = new URL(indexUrl);
query.searchParams.set("url", "*.eg/*");
query.searchParams.set("output", "json");
query.searchParams.set("filter", "status:200");
query.searchParams.set("collapse", "urlkey");
query.searchParams.set("limit", String(maxUrls));

const indexResponse = await fetch(query, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(120000) });
if (!indexResponse.ok) throw new Error(`Common Crawl index HTTP ${indexResponse.status}`);
const lines = (await indexResponse.text()).split(/\r?\n/).filter(Boolean);
const urls = [...new Set(lines.map((line) => {
  try { return validEgUrl(JSON.parse(line).url); } catch { return null; }
}).filter(Boolean))].slice(0, maxUrls);
console.log(`Common Crawl returned ${urls.length} Egyptian URLs from ${indexUrl}`);

const results = [];
for (const url of urls) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("text/html")) continue;
    const finalUrl = validEgUrl(response.url);
    if (!finalUrl) continue;
    results.push(metadata(await response.text(), finalUrl));
    if (results.length % 25 === 0) console.log(`Fetched ${results.length} Egyptian pages`);
  } catch {
    // Continue when a page is offline, blocked, or times out.
  }
}

await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile("artifacts/eg-domains-results.json", JSON.stringify({
  source: "Common Crawl",
  index: indexUrl,
  limitation: "Common Crawl is a free public web index, not an official complete registry of every .eg domain.",
  generated_at: new Date().toISOString(),
  indexed_urls: urls.length,
  reachable_pages: results.length,
  results
}, null, 2) + "\n");
console.log(`Wrote ${results.length} reachable Egyptian pages to artifacts/eg-domains-results.json`);
