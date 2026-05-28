import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

function base64ToBlob(base64, mimeType) {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mimeType })
}

export const uploadIconePWA = async (base64Image) => {
  try {
    const mimeType = base64Image.split(';')[0].split(':')[1]
    const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1]
    const base64Data = base64Image.split(',')[1]
    const blob = base64ToBlob(base64Data, mimeType)

    const { error } = await supabase.storage
      .from('assets')
      .upload(`icone-pwa.${ext}`, blob, { contentType: mimeType, upsert: true })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl(`icone-pwa.${ext}`)

    return urlData.publicUrl
  } catch (err) {
    console.error('[PetVet] Erro upload ícone PWA:', err)
    return null
  }
}

export const initStorage = async () => {
  const { data, error } = await supabase.storage.createBucket('assets', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    fileSizeLimit: 5242880,
  })
  return { data, error }
}

