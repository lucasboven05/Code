export const env = () => ({
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ALLIE_MODEL: process.env.ALLIE_MODEL,
  CRON_SECRET: process.env.CRON_SECRET,
});
