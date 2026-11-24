interface CloudflareEnv extends WranglerBindings {
  APP_ENV: "local" | "staging" | "production";
  WHATSAPP_MODE: "disabled" | "fake" | "test" | "live";
  ACCESS_ACCOUNT_ID?: string;
  ACCESS_APP_ID?: string;
  ACCESS_POLICY_ID?: string;
  ACCESS_API_TOKEN?: string;
  ACCESS_IDP_ID?: string;
  /** Transitional compatibility with the first staging configuration. */
  ACCESS_GOOGLE_IDP_ID?: string;
  BACKUP_FILES?: R2Bucket;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  WHATSAPP_APPROVED_TEST_RECIPIENTS?: string;
  JOB_QUEUE?: Queue<any>;
}
