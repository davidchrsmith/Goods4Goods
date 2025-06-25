import { createClient } from '@supabase/supabase-js'
import Config from 'react-native-config'

const supabaseUrl = Config.SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = Config.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})