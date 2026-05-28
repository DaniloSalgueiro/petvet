import { createClient } from '@supabase/supabase-js'

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

    const logo = data?.value?.iconePWA || data?.value?.logoP

    if (typeof logo === 'string' && logo.startsWith('data:image')) {
      const [header, base64] = logo.split(',')
      const mimeType = header.split(';')[0].split(':')[1]
      const buffer = Buffer.from(base64, 'base64')

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
  } catch {}

  // Fallback: redireciona para o SVG estático
  return new Response(null, {
    status: 302,
    headers: { Location: '/icon.svg' },
  })
}

export const config = { path: '/app-icon' }
