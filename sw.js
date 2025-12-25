const CACHE_NAME = 'moyragi-v1';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/auth.js',
    './js/db.js',
    './js/ui.js',
    './js/excel.js',
    './js/backup.js',
    './js/config.js',
    './js/supabase.js',
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.rtl.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm',
    'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    // Strategy: Stale-While-Revalidate for most things,
    // but for API calls (supabase), we might want Network First.

    const url = new URL(event.request.url);

    if (url.origin === location.origin || ASSETS.includes(event.request.url)) {
        // App Shell Strategy: Cache First, falling back to network
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    } else {
        // External APIs (Supabase): Network First, falling back to cache (if we decided to cache data)
        // Currently we don't explicitly cache Supabase responses in Cache API (Supabase client might handle some in-memory).
        // For basic PWA, let's just allow network.
        event.respondWith(fetch(event.request));
    }
});
