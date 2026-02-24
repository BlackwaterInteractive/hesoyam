import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client instance (singleton)
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    logger.info('Supabase client initialized');
  }
  return supabaseClient;
}

/**
 * Test Supabase connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    logger.success('Supabase connection verified');
    return true;
  } catch (error) {
    logger.error('Supabase connection failed', error);
    return false;
  }
}
