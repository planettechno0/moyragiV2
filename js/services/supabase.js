import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { config } from './config.js'

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
