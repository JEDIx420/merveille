interface CloudflareEnv {
  DB: D1Database;
  PROJECT_FILES: R2Bucket;
  APP_ENV: "local" | "staging" | "production";
  APP_ORIGIN: string;
  ACCESS_ISSUER: string;
  ACCESS_AUDIENCE: string;
  BUSINESS_TIMEZONE: string;
  WHATSAPP_MODE: "fake" | "test" | "live";
  ALLOW_SYNTHETIC_AUTH?: string;
  JOB_QUEUE?: Queue<any>;
}
