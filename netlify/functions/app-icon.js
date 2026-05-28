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

    const id = data?.value || {}
    const icone = id.iconePWA || id.iconeApp || id.logoP

    if (typeof icone === 'string' && icone.startsWith('data:image')) {
      const [header, base64Data] = icone.split(',')
      const mimeType = header.split(';')[0].split(':')[1]
      const buffer = Buffer.from(base64Data, 'base64')

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
  } catch {}

  return new Response(null, {
    status: 302,
    headers: { Location: '/icon.svg' },
  })
}

export const config = { path: '/app-icon' }
