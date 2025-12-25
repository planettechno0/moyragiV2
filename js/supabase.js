import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase URL or Key is missing. Please check config.js file.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
