const VERSION = 'bardy-shell-v39-events-3';
const SHELL = [
  '/', '/index.html', '/article.html', '/results.html', '/web.html', '/ai.html',
  '/images.html', '/videos.html', '/news.html', '/local.html', '/events.html',
  '/updates.html', '/about.html', '/contact.html', '/privacy.html', '/terms.html', '/help.html', '/sitemap.html', '/404.html', '/suggestions.json', '/assets/bardy-logo.webp', '/assets/bardy-share-preview.jpg', '/assets/bardy-radio-share-preview.jpg',
  '/assets/flag-search-logo.webp', '/assets/papyrus-light.webp',
  '/assets/icon-192.png', '/assets/icon-512.png', '/assets/apple-touch-icon.png',
  '/assets/favicon.png', '/assets/site-placeholder.svg', '/assets/news-placeholder.svg',
  '/assets/bardy-home.css', '/assets/bardy-home.js', '/assets/bardy-article.css',
  '/assets/bardy-article.js', '/assets/bardy-results.css', '/assets/bardy-search.js',
  '/assets/bardy-news.css', '/assets/bardy-news.js', '/assets/bardy-content.css', '/manifest.webmanifest',
  '/assets/bardy-shell.css', '/assets/bardy-shell.js', '/assets/bardy-ui.css', '/radio.html',
  '/assets/bg/backgrounds.json',
  '/assets/bg/photos/giza-1.webp', '/assets/bg/photos/sphinx-1.webp',
  '/assets/bg/photos/karnak-1.webp', '/assets/bg/photos/abu-simbel-1.webp',
  '/assets/bg/photos/nile-1.webp', '/assets/bg/photos/luxor-1.webp', '/assets/bg/photos/philae-1.webp',
];
const SHELL_PATHS = new Set(SHELL);
const OFFLINE_DOCUMENTS = new Map([
  ['/', '/'], ['/index.html', '/index.html'], ['/article.html', '/article.html'],
  ['/results.html', '/results.html'], ['/web', '/web.html'], ['/web.html', '/web.html'],
  ['/ai', '/ai.html'], ['/ai.html', '/ai.html'], ['/images', '/images.html'],
  ['/images.html', '/images.html'], ['/videos', '/videos.html'], ['/videos.html', '/videos.html'],
  ['/news', '/news.html'], ['/news.html', '/news.html'], ['/local', '/local.html'],
  ['/local.html', '/local.html'], ['/events', '/events.html'], ['/events.html', '/events.html'],
  ['/updates', '/updates.html'], ['/updates.html', '/updates.html'],
  ['/about', '/about.html'], ['/about.html', '/about.html'],
  ['/contact', '/contact.html'], ['/contact.html', '/contact.html'],
  ['/privacy', '/privacy.html'], ['/privacy.html', '/privacy.html'],
  ['/terms', '/terms.html'], ['/terms.html', '/terms.html'],
  ['/help', '/help.html'], ['/help.html', '/help.html'],
  ['/sitemap', '/sitemap.html'], ['/sitemap.html', '/sitemap.html'],
  ['/radio', '/radio.html'], ['/radio.html', '/radio.html'],
]);

self.addEventListener('install', event => {
  const freshRequests = SHELL.map(path => new Request(path, { cache: 'reload' }));
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(freshRequests))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    // Keep navigations network-first; offline uses the requested cached shell page,
    // then the home page. Query-specific search/API responses are never cached.
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
      } catch {
        const documentPath = OFFLINE_DOCUMENTS.get(url.pathname);
        const cachedPage = documentPath
          ? await caches.match(`${url.origin}${documentPath}`, { ignoreSearch: true })
          : null;
        return cachedPage || await caches.match(`${url.origin}/`, { ignoreSearch: true });
      }
    })());
    return;
  }

  // Cache only the explicit, bounded app shell; never cache arbitrary API/results.
  if (!SHELL_PATHS.has(url.pathname)) return;

  // HTML references version their CSS/JS with query strings. Match those
  // requests to the cached shell file so an installed app keeps its layout
  // and behavior when it is launched without a network connection.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request)),
  );
});
