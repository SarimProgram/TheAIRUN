import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET should be at least 16 characters'),
  GOOGLE_OAUTH_CLIENT_IDS: z.string().optional().default(''),
  APPLE_OAUTH_AUDIENCES: z.string().optional().default(''),
  REVENUECAT_SECRET_API_KEY: z.string().optional().default(''),
  REVENUECAT_WEBHOOK_AUTH_SECRET: z.string().optional().default(''),
  PAYWALL_TRIAL_DAYS: z.coerce.number().int().positive().default(7),
  PAYWALL_ENABLED: z.coerce.boolean().default(true),
  REVENUECAT_ENTITLEMENT_ID: z.string().min(1).default('RunTogether Pro'),
  APNS_KEY_ID: z.string().optional().default(''),
  APNS_TEAM_ID: z.string().optional().default(''),
  APNS_BUNDLE_ID: z.string().optional().default(''),
  APNS_AUTH_KEY: z.string().optional().default(''),
  APNS_AUTH_KEY_PATH: z.string().optional().default(''),
  APNS_USE_SANDBOX: z.coerce.boolean().default(false),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_OAUTH_CLIENT_IDS: process.env.GOOGLE_OAUTH_CLIENT_IDS,
  APPLE_OAUTH_AUDIENCES: process.env.APPLE_OAUTH_AUDIENCES,
  REVENUECAT_SECRET_API_KEY: process.env.REVENUECAT_SECRET_API_KEY,
  REVENUECAT_WEBHOOK_AUTH_SECRET: process.env.REVENUECAT_WEBHOOK_AUTH_SECRET,
  PAYWALL_TRIAL_DAYS: process.env.PAYWALL_TRIAL_DAYS,
  PAYWALL_ENABLED: process.env.PAYWALL_ENABLED,
  REVENUECAT_ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID,
  APNS_KEY_ID: process.env.APNS_KEY_ID,
  APNS_TEAM_ID: process.env.APNS_TEAM_ID,
  APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID,
  APNS_AUTH_KEY: process.env.APNS_AUTH_KEY,
  APNS_AUTH_KEY_PATH: process.env.APNS_AUTH_KEY_PATH,
  APNS_USE_SANDBOX: process.env.APNS_USE_SANDBOX,
});
