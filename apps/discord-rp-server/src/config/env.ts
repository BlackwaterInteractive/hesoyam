import { config } from 'dotenv';

// Load environment variables
config();

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

  // Supabase
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_KEY'),

  // Server
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  agentTimeoutMs: parseInt(optionalEnv('AGENT_TIMEOUT_MS', '60000'), 10),
} as const;

export type Env = typeof env;
