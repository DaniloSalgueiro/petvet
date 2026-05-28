import { createClient } from '@supabase/supabase-js'

const FALLBACK = {
  name: 'PetVet',
  short_name: 'PetVet',
  description: 'Sistema de gestão veterinária — Salgueiro Systems',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#27B5AC',
  orientation: 'portrait-primary',
  icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
}

export default async (_req, _context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    const { data } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', 'petvet-identidade')
      .maybeSingle()

    const id = data?.value ?? {}
    const nome      = id.nomeCompleto  || id.nomeP || 'PetVet'
    const shortName = id.nomeAbreviado || 'PetVet'
    const theme     = id.corPrimaria   || '#27B5AC'
    const iconSrc   = id.iconePWA || id.logoP
    const hasLogo   = typeof iconSrc === 'string' && iconSrc.startsWith('data:image')

    const manifest = {
      ...FALLBACK,
      name: nome,
      short_name: shortName,
      theme_color: theme,
      icons: hasLogo
        ? [{ src: '/app-icon', sizes: 'any', type: 'image/png', purpose: 'any maskable' }]
        : FALLBACK.icons,
    }

    return new Response(JSON.stringify(manifest, null, 2), {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch {
    return new Response(JSON.stringify(FALLBACK), {
      headers: { 'Content-Type': 'application/manifest+json' },
    })
  }
}

export const config = { path: '/manifest.json' }
