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
    const icone = identidade.iconePWA || identidade.iconeApp || identidade.logoP

    if (icone && icone.startsWith('data:image')) {
      const mimeType   = icone.split(';')[0].split(':')[1]
      const base64Data = icone.split(',')[1]
      const buffer     = Buffer.from(base64Data, 'base64')

      return {
        statusCode: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
        body: buffer.toString('base64'),
        isBase64Encoded: true,
      }
    }

    return {
      statusCode: 302,
      headers: { Location: '/icon.svg' },
      body: '',
    }
  } catch (err) {
    return {
      statusCode: 302,
      headers: { Location: '/icon.svg' },
      body: '',
    }
  }
}
