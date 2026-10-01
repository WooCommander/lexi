import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/** false — нет .env; экран входа покажет подсказку вместо падения при импорте. */
export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY

export const supabase = createClient(
    SUPABASE_URL || 'http://localhost:54321',
    SUPABASE_ANON_KEY || 'missing-anon-key',
)
