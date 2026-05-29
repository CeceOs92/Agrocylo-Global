import 'dotenv/config';

// ---------------------------------------------------------------------------
// Required environment variables
// These must be set in production; startup fails if any are missing.
// ---------------------------------------------------------------------------
const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'RPC_URL',
  'PRODUCTION_CONTRACT_ID',
  'ESCROW_CONTRACT_ID',
] as const;

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function requireEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const isProduction = (process.env['NODE_ENV'] ?? 'development') === 'production';

if (isProduction) {
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // Fail hard so misconfigured deployments never silently run with bad state.
    throw new Error(
      `[config] Startup aborted — missing required environment variables in production:\n  ${missing.join('\n  ')}\n` +
      `Set these in your deployment environment before starting the server.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Config object
//
// Required variables:   must be present in production (enforced above).
// Optional variables:   have safe defaults for local development.
//
// All required env vars must be documented here.
// ---------------------------------------------------------------------------
export const config = {
  // Server
  port: parseInt(getEnv('PORT') ?? '5001', 10),
  nodeEnv: getEnv('NODE_ENV') ?? 'development',
  logLevel: getEnv('LOG_LEVEL') ?? 'debug',

  // Database — required in production
  // DATABASE_URL: PostgreSQL connection string e.g. postgresql://user:pass@host:5432/db
  databaseUrl: isProduction ? requireEnv('DATABASE_URL') : (getEnv('DATABASE_URL') ?? ''),

  // Stellar / Soroban RPC — required in production
  // RPC_URL: Soroban RPC endpoint e.g. https://soroban-testnet.stellar.org
  rpcUrl: isProduction
    ? requireEnv('RPC_URL')
    : (getEnv('RPC_URL') ?? 'https://soroban-testnet.stellar.org'),

  // PRODUCTION_CONTRACT_ID: Stellar contract ID for the production escrow contract
  contractId: isProduction
    ? requireEnv('PRODUCTION_CONTRACT_ID')
    : (getEnv('PRODUCTION_CONTRACT_ID') ?? ''),

  // ESCROW_CONTRACT_ID: Stellar contract ID for the multi-contract escrow listener
  escrowContractId: isProduction
    ? requireEnv('ESCROW_CONTRACT_ID')
    : (getEnv('ESCROW_CONTRACT_ID') ?? ''),

  // PRODUCTION_ESCROW_CONTRACT_ID: falls back to PRODUCTION_CONTRACT_ID if not set
  productionEscrowContractId:
    getEnv('PRODUCTION_ESCROW_CONTRACT_ID') ??
    getEnv('PRODUCTION_CONTRACT_ID') ??
    '',

  // Rate limiting
  rateLimitWindowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS') ?? '60000', 10),
  rateLimitMaxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS') ?? '100', 10),
  rateLimitWriteMaxRequests: parseInt(getEnv('RATE_LIMIT_WRITE_MAX_REQUESTS') ?? '10', 10),

  // Supabase — campaign image upload
  // SUPABASE_URL: Supabase project URL
  // SUPABASE_ANON_KEY: Supabase anonymous/public key
  // SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (server-side only)
  supabaseUrl: getEnv('SUPABASE_URL') ?? '',
  supabaseAnonKey: getEnv('SUPABASE_ANON_KEY') ?? '',
  supabaseServiceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  campaignImagesBucket: getEnv('SUPABASE_CAMPAIGN_IMAGES_BUCKET') ?? 'campaign-images',
  campaignImagePlaceholderUrl:
    getEnv('CAMPAIGN_IMAGE_PLACEHOLDER_URL') ??
    'https://placehold.co/800x800/png?text=No+Image',
};
