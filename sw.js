const CACHE_NAME = 'pocket-pulls-v6';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './logo.svg',
    './logo.png'
];

// Install event: Cache files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Fetch event: Serve cached files if offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found, else fetch from network
                return response || fetch(event.request);
            })
    );
});