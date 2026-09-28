import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Anon key only — this form can insert its own row and nothing else (see db/schema.sql).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
