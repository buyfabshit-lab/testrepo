/**
 * Central env access. Names match .env.example exactly.
 * Nothing here ever logs a value.
 */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}
function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}
function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  storageBucket: () => opt("SUPABASE_STORAGE_BUCKET", "artwork"),
  stripeSecretKey: () => opt("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => opt("STRIPE_WEBHOOK_SECRET"),
  ssAccountNumber: () => opt("SS_ACCOUNT_NUMBER"),
  ssApiKey: () => opt("SS_API_KEY"),
  sanmarDataUrl: () => opt("SANMAR_DATA_URL"),
  shopifyDcShop: () => opt("SHOPIFY_DC_SHOP", "cae949-fc"),
  shopifyDcClientId: () => opt("SHOPIFY_DC_CLIENT_ID"),
  shopifyDcClientSecret: () => opt("SHOPIFY_DC_CLIENT_SECRET"),
  skrewuSupabaseUrl: () => opt("SKREWU_SUPABASE_URL"),
  skrewuServiceKey: () => opt("SKREWU_SERVICE_KEY"),
  googleServiceAccountJson: () => opt("GOOGLE_SERVICE_ACCOUNT_JSON"),
  driveFusionIntakeId: () => opt("DRIVE_FUSION_INTAKE_ID", "1hmg3Gh8H5o54hXizMWK1yVAbJ-HmYWEm"),
  n8nBaseUrl: () => opt("N8N_BASE_URL", "https://deathcorps187.app.n8n.cloud"),
  n8nWebhookSecret: () => opt("N8N_WEBHOOK_SECRET"),
  anthropicApiKey: () => opt("ANTHROPIC_API_KEY"),
  hedraApiKey: () => opt("HEDRA_API_KEY"),
  resendApiKey: () => opt("RESEND_API_KEY"),
  twilioAccountSid: () => opt("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: () => opt("TWILIO_AUTH_TOKEN"),
  twilioMessagingServiceSid: () => opt("TWILIO_MESSAGING_SERVICE_SID"),
  smsEnabled: () => bool("SMS_ENABLED", false),
  shipstationApiKey: () => opt("SHIPSTATION_API_KEY"),
  shipstationApiSecret: () => opt("SHIPSTATION_API_SECRET"),
  officePinHash: () => opt("OFFICE_PIN_HASH"),
  appSigningSecret: () => opt("APP_SIGNING_SECRET"),
  liveMoney: () => bool("LIVE_MONEY", false),
  appUrl: () => opt("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  emailFrom: () => opt("EMAIL_FROM", "Midnight Fusion <orders@midnightfusion.co>"),
  justinEmail: () => opt("JUSTIN_EMAIL"),
  jeffEmail: () => opt("JEFF_EMAIL"),
  dannyEmail: () => opt("DANNY_EMAIL"),
};

/** Real-money gate: S&S POs, Stripe live charges, outbound SMS. */
export function moneyIsLive(): boolean {
  return env.liveMoney();
}
