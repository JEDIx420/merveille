/**
 * DOCUMENTATION-ONLY interfaces. No runtime code is implemented here.
 * Generate actual Cloudflare types from the chosen/pinned Wrangler scaffold.
 * D1Database, R2Bucket and Queue refer to provider types not installed in this handoff.
 * No browser bundle may import the secret-bearing server interfaces.
 */
interface MarvelWebBindingsExample {
  DB: D1Database;
  PROJECT_FILES: R2Bucket;
  JOB_QUEUE: Queue<{ eventId: string; schemaVersion: 1 }>;
  APP_ENV: "local" | "staging" | "production";
  APP_ORIGIN: string;
  ACCESS_ISSUER: string;
  ACCESS_AUDIENCE: string;
  BUSINESS_TIMEZONE: string;
  WHATSAPP_MODE: "fake" | "test" | "live";
}

interface MarvelJobsBindingsExample {
  DB: D1Database;
  JOB_QUEUE: Queue<{ eventId: string; schemaVersion: 1 }>;
  APP_ENV: "local" | "staging" | "production";
  APP_ORIGIN: string;
  BUSINESS_TIMEZONE: string;
  WHATSAPP_MODE: "fake" | "test" | "live";
  META_ACCESS_TOKEN: string; // Worker secret; needed only for configured real delivery.
  META_PHONE_NUMBER_ID: string;
  META_GRAPH_API_VERSION: string; // Verified supported version chosen at setup.
}

interface MarvelWebhookSecretsExample {
  META_APP_SECRET: string;
  META_VERIFY_TOKEN: string;
}

interface MarvelIdentityProvisionerExample {
  DB: D1Database;
  ACCESS_MANAGEMENT_TOKEN: string; // Separate control-plane Worker secret.
  ACCESS_ACCOUNT_ID: string;
  ACCESS_APPLICATION_ID: string;
  ACCESS_POLICY_ID: string;
}

interface MarvelBackupBindingsExample {
  BACKUP_BUCKET: R2Bucket;
  D1_EXPORT_TOKEN: string; // Separate backup operator/job secret.
  CLOUDFLARE_ACCOUNT_ID: string;
  TARGET_DATABASE_ID: string;
}
