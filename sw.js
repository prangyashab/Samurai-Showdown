const CACHE_NAME = 'samurai-v2';
const urlsToCache = [
    './',
    './index.html',
    './game.html',
    './levels.html',
    './index.js',
    './js/audio.js',
    './js/classes.js',
    './js/utils.js',
    './img/homepage.png',
    './img/setting.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

// Update the cache immediately when a new SW is activated
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
