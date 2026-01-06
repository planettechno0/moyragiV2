const CACHE_NAME = 'moyragi-v5';
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
    './js/date_utils.js',
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.rtl.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm',
    'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs',
    'https://cdn.jsdelivr.net/npm/jalaali-js/dist/jalaali.js'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Force activation
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Take control immediately
            caches.keys().then(keys => Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            ))
        ])
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.origin === location.origin || ASSETS.includes(event.request.url)) {
        // Network First, falling back to cache
        // This ensures the user always gets the latest version if online.
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Update cache with new response
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // External APIs (Supabase): Network First, falling back to cache (if we decided to cache data)
        // Currently we don't explicitly cache Supabase responses in Cache API (Supabase client might handle some in-memory).
        // For basic PWA, let's just allow network.
        event.respondWith(fetch(event.request));
    }
});
