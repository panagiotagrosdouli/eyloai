import { createClient } from '@supabase/supabase-js';
import { environment } from '@/lib/config/env';

export const isSupabaseConfigured = environment.ok;

export const supabase = isSupabaseConfigured
  ? createClient(
      environment.values.VITE_SUPABASE_URL,
      environment.values.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  : null;

export function requireSupabase() {
  if (!supabase) {
    const error = new Error('Authentication service is not configured.');
    error.code = 'SUPABASE_CONFIGURATION_ERROR';
    throw error;
  }

  return supabase;
}
