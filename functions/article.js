const FALLBACK_IMAGE = "https://bardy.pages.dev/assets/bardy-share-preview.jpg";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function externalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function first150(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150)
    .trimEnd();
}

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title") || "الأخبار على بردي";
  const description = first150(url.searchParams.get("description") || url.searchParams.get("text")) || "استكشف أحدث الأخبار عبر بردي.";
  const image = externalUrl(url.searchParams.get("image")) || FALLBACK_IMAGE;
  const canonical = `${url.origin}${url.pathname}${url.search}`;
  const source = externalUrl(url.searchParams.get("url"));
  const articleJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    image: [image],
    mainEntityOfPage: canonical,
    url: canonical,
  });

  return new Response(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#b8862b">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/assets/favicon.png" sizes="64x64" type="image/png">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/bardy-article.css?v=article-news-v2">
  <link rel="stylesheet" href="/assets/bardy-shell.css?v=shell-5">
  <link rel="stylesheet" href="/assets/bardy-ui.css?v=ui-3">
  <title>${esc(title)} — بردي</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ar_EG">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:site_name" content="بردي">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="675">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:image:alt" content="${esc(title)}">
  <script type="application/ld+json">${articleJson}</script>
</head>
<body>
  <header class="article-header"><a class="article-brand" href="/" aria-label="العودة إلى الرئيسية"><img src="/assets/bardy-logo.webp" alt="بردي"></a><a class="article-back" href="/news.html">كل الأخبار</a></header>
  <main class="article-page" id="articleApp"><div class="article-loading">جارٍ تجهيز الخبر…</div></main>
  <footer><span>بردي — محرك البحث المصري</span><span><a href="/">العودة إلى البحث</a> · <a href="/privacy">الخصوصية</a> · <a href="/terms">الشروط</a> · <a href="/contact">التواصل</a></span></footer>
  <script src="/assets/bardy-article.js?v=article-news-share-v1"></script>
  <script src="/assets/bardy-shell.js?v=shell-5"></script>
</body>
</html>`, { headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
