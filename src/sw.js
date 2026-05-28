import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const MANIFEST_CACHE = 'petvet-manifest'

self.addEventListener('message', (event) => {
  if (event.data?.type === 'UPDATE_MANIFEST') {
    const identidade = event.data.payload || {}
    caches.open(MANIFEST_CACHE).then(cache => {
      cache.put('/manifest.json', new Response(
        JSON.stringify(buildManifest(identidade)),
        { headers: { 'Content-Type': 'application/manifest+json' } }
      ))
    })
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/manifest.json')) {
    event.respondWith(
      caches.open(MANIFEST_CACHE).then(cache =>
        cache.match('/manifest.json').then(cached => cached || fetch(event.request))
      )
    )
  }
})

function buildManifest(identidade) {
  return {
    name: identidade.nomeCompleto || 'Emporium Vazpet + Tatá Bichos',
    short_name: identidade.nomeAbreviado || 'PetVet',
    description: 'Sistema de gestão veterinária — Salgueiro Systems',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: identidade.corPrimaria || '#27B5AC',
    orientation: 'portrait-primary',
    icons: identidade.iconePWA ? [
      { src: identidade.iconePWA, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: identidade.iconePWA, sizes: '192x192', type: 'image/png', purpose: 'any maskable' }
    ] : [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
    ]
  }
}
