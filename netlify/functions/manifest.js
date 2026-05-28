const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    const { data } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', 'petvet-identidade')
      .single()

    const identidade = data?.value || {}
    const nome       = identidade.nomeCompleto  || identidade.nomeP || 'Emporium Vazpet + Tatá Bichos'
    const shortName  = identidade.nomeAbreviado || 'PetVet'
    const themeColor = identidade.corPrimaria   || '#27B5AC'

    const manifest = {
      name: nome,
      short_name: shortName,
      description: 'Sistema de gestão veterinária — Salgueiro Systems',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: themeColor,
      orientation: 'portrait-primary',
      icons: [
        {
          src: '/app-icon',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
        },
      ],
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify(manifest),
    }
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/manifest+json' },
      body: JSON.stringify({
        name: 'PetVet',
        short_name: 'PetVet',
        start_url: '/',
        display: 'standalone',
        theme_color: '#27B5AC',
        background_color: '#ffffff',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      }),
    }
  }
}
