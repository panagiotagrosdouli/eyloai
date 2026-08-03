import { createClient } from '@supabase/supabase-js';
import { environment } from '@/lib/config/env';

export const isSupabaseConfigured = environment.ok;

// In deployed builds, route Supabase HTTP traffic through the EYLO domain.
// This keeps authentication and database requests working in browsers or
// networks that block direct navigation to *.supabase.co.
const supabaseUrl = typeof window !== 'undefined' && import.meta.env.PROD
  ? `${window.location.origin}/supabase`
  : environment.values.VITE_SUPABASE_URL;

export const supabase = isSupabaseConfigured
  ? createClient(
      supabaseUrl,
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
