import { config } from 'dotenv';

// Load environment-specific .env file
// Usage: NODE_ENV=staging npm start → loads .env.staging
// Default: loads .env
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
config({ path: envFile });
config(); // fallback to .env for any missing vars

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  // Discord
  discordBotToken: requireEnv('DISCORD_BOT_TOKEN'),
  discordGuildId: requireEnv('DISCORD_GUILD_ID'),

  // Supabase (still needed for reads + Realtime subscriptions)
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_KEY'),

  // Backend API
  apiBaseUrl: requireEnv('API_BASE_URL'),
  apiKey: requireEnv('API_KEY'),

  // Server
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  agentTimeoutMs: parseInt(optionalEnv('AGENT_TIMEOUT_MS', '60000'), 10),
} as const;

export type Env = typeof env;
