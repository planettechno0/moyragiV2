const CACHE_NAME = 'moyragi-v6';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/app.js',
    './js/core/state.js',
    './js/services/auth.js',
    './js/services/db.js',
    './js/services/excel.js',
    './js/services/backup.js',
    './js/services/config.js',
    './js/services/supabase.js',
    './js/services/date_utils.js',
    './js/components/shared/Toast.js',
    './js/components/shared/Utils.js',
    './js/components/dashboard/DashboardView.js',
    './js/components/dashboard/StoreList.js',
    './js/components/dashboard/StoreCard.js',
    './js/components/dashboard/SearchBar.js',
    './js/components/dashboard/AddStoreModal.js',
    './js/components/orders/OrdersView.js',
    './js/components/orders/OrderModal.js',
    './js/components/visits/VisitList.js',
    './js/components/visits/VisitModal.js',
    './js/components/management/ManagementView.js',
    './js/components/management/StoreTable.js',
    './js/components/management/Statistics.js',
    './js/components/settings/SettingsModal.js',
    './js/components/settings/RegionManager.js',
    './js/components/settings/ProductManager.js',
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.rtl.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm',
    'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs',
    'https://cdn.jsdelivr.net/npm/jalaali-js/dist/jalaali.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
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
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        event.respondWith(fetch(event.request));
    }
});
