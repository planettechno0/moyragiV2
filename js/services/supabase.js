import { config } from './config.js'

// Supabase Client
// We assume supabase-js is loaded via CDN in index.html and available as window.supabase
// BUT for module usage, we might want to use the global object if not using a bundler.
// However, standard import maps or CDN imports in module work.
// Current setup uses global `supabase` (from <script> tag).
// But `createClient` needs to be called.
// Usually `import { createClient } from '...'`
// If index.html loads the script, `supabase` global object usually has `createClient`.

let supabaseClient = null

if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
} else {
    console.error('Supabase library not loaded')
}

export const supabase = supabaseClient
