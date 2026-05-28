export function injectManifest(identidade) {
  const iconUrl = identidade?.iconePWAUrl || identidade?.iconePWA || null

  const manifest = {
    name: identidade?.nomeCompleto || 'Emporium Vazpet + Tatá Bichos',
    short_name: identidade?.nomeAbreviado || 'PetVet',
    description: 'Sistema de gestão veterinária — Salgueiro Systems',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: identidade?.corPrimaria || '#27B5AC',
    orientation: 'portrait-primary',
    icons: iconUrl ? [
      { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: iconUrl, sizes: '192x192', type: 'image/png' }
    ] : [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
    ]
  }

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
  const newUrl = URL.createObjectURL(blob)

  let link = document.querySelector('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }

  const oldUrl = link.href
  link.href = newUrl
  if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl)
}
