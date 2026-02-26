const CACHE_NAME = 'samurai-v1';
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
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
