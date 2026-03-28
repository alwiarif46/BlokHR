import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/** Reads an env var, returns undefined if not set */
function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

/** Reads a required env var, throws if missing */
export function reqEnv(key: string): string {
  const val = env(key);
  if (val === undefined) {
    throw new Error(`FATAL: Required environment variable ${key} is not set. Server cannot start.`);
  }
  return val;
}

/** Reads an env var with a default */
function envDefault(key: string, fallback: string): string {
  return env(key) ?? fallback;
}

/** Reads an env var as integer with a default */
function envInt(key: string, fallback: number): number {
  const raw = env(key);
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`FATAL: Environment variable ${key} must be an integer, got "${raw}"`);
  }
  return parsed;
}

export interface AppConfig {
  /** Server */
  port: number;
  nodeEnv: string;
  logLevel: string;
  corsOrigins: string;

  /** Database */
  dbEngine: 'sqlite' | 'postgres';
  dbPath: string;
  dbUrl: string;

  /** Azure Blob Storage */
  azureBlobConnectionString: string;
  azureBlobContainer: string;

  /** Azure Bot Framework (optional) */
  azureBotAppId: string | undefined;
  azureBotAppPassword: string | undefined;

  /** Notification channels (optional) */
  slackBotToken: string | undefined;
  slackSigningSecret: string | undefined;
  googleChatServiceAccountJson: string | undefined;
  clickupApiToken: string | undefined;
  whatsappPhoneId: string | undefined;
  whatsappToken: string | undefined;
  telegramBotToken: string | undefined;

  /** Email / SMTP (optional) */
  smtpHost: string | undefined;
  smtpPort: number;
  smtpUser: string | undefined;
  smtpPass: string | undefined;
  smtpFrom: string | undefined;

  /** LLM (optional) */
  llmProvider: 'anthropic' | 'ollama' | undefined;
  llmApiKey: string | undefined;
  llmBaseUrl: string | undefined;
  llmModel: string | undefined;

  /** Facial Recognition (optional) */
  azureFaceEndpoint: string | undefined;
  azureFaceKey: string | undefined;

  /** Timezone & Logical Day */
  defaultTimezone: string;
  logicalDayChangeTime: string;

  /** Action links (email one-click approve/reject) */
  serverBaseUrl: string | undefined;
  actionLinkSecret: string | undefined;

  /** Discord Bot (interactive buttons, replaces webhook) */
  discordBotToken: string | undefined;
  discordAppId: string | undefined;

  /** Meeting Platform Integrations (optional — discovery + attendance) */
  zoomAccountId: string | undefined;
  zoomClientId: string | undefined;
  zoomClientSecret: string | undefined;
  webexBotToken: string | undefined;
  gotoClientId: string | undefined;
  gotoClientSecret: string | undefined;
  bluejeansApiKey: string | undefined;

  /** Paths */
  publicDir: string;
  migrationsDir: string;

  /** Redis / Valkey (optional — blank = in-memory EventBus) */
  redisUrl: string | undefined;
  eventRetentionDays: number;
}

/** Builds and validates the full application config. Throws on missing required vars. */
export function loadConfig(): AppConfig {
  const dbEngineRaw = envDefault('DB_ENGINE', 'sqlite');
  const validDbEngines = new Set<string>(['sqlite', 'postgres']);
  if (!validDbEngines.has(dbEngineRaw)) {
    throw new Error(`FATAL: DB_ENGINE must be "sqlite" or "postgres", got "${dbEngineRaw}"`);
  }
  const dbEngine = dbEngineRaw as 'sqlite' | 'postgres';

  const llmProviderRaw = env('LLM_PROVIDER');
  const validLlmProviders = new Set<string>(['anthropic', 'ollama']);
  if (llmProviderRaw !== undefined && !validLlmProviders.has(llmProviderRaw)) {
    throw new Error(`FATAL: LLM_PROVIDER must be "anthropic" or "ollama", got "${llmProviderRaw}"`);
  }
  const llmProvider = llmProviderRaw as 'anthropic' | 'ollama' | undefined;

  const logicalDayChangeTime = envDefault('LOGICAL_DAY_CHANGE_TIME', '06:00');
  if (!/^\d{2}:\d{2}$/.test(logicalDayChangeTime)) {
    throw new Error(
      `FATAL: LOGICAL_DAY_CHANGE_TIME must be HH:MM format, got "${logicalDayChangeTime}"`,
    );
  }

  return {
    port: envInt('PORT', 3000),
    nodeEnv: envDefault('NODE_ENV', 'production'),
    logLevel: envDefault('LOG_LEVEL', 'info'),
    corsOrigins: envDefault('CORS_ORIGINS', '*'),

    dbEngine,
    dbPath: envDefault('DB_PATH', path.join('/home', 'data', 'shaavir.db')),
    dbUrl: envDefault('DB_URL', ''),

    azureBlobConnectionString: envDefault('AZURE_BLOB_CONNECTION_STRING', ''),
    azureBlobContainer: envDefault('AZURE_BLOB_CONTAINER', 'shaavir-files'),

    azureBotAppId: env('AZURE_BOT_APP_ID'),
    azureBotAppPassword: env('AZURE_BOT_APP_PASSWORD'),

    slackBotToken: env('SLACK_BOT_TOKEN'),
    slackSigningSecret: env('SLACK_SIGNING_SECRET'),
    googleChatServiceAccountJson: env('GOOGLE_CHAT_SERVICE_ACCOUNT_JSON'),
    clickupApiToken: env('CLICKUP_API_TOKEN'),
    discordBotToken: env('DISCORD_BOT_TOKEN'),
    discordAppId: env('DISCORD_APP_ID'),
    whatsappPhoneId: env('WHATSAPP_PHONE_ID'),
    whatsappToken: env('WHATSAPP_TOKEN'),
    telegramBotToken: env('TELEGRAM_BOT_TOKEN'),

    smtpHost: env('SMTP_HOST'),
    smtpPort: envInt('SMTP_PORT', 587),
    smtpUser: env('SMTP_USER'),
    smtpPass: env('SMTP_PASS'),
    smtpFrom: env('SMTP_FROM'),

    llmProvider,
    llmApiKey: env('LLM_API_KEY'),
    llmBaseUrl: env('LLM_BASE_URL'),
    llmModel: env('LLM_MODEL'),

    azureFaceEndpoint: env('AZURE_FACE_ENDPOINT'),
    azureFaceKey: env('AZURE_FACE_KEY'),

    serverBaseUrl: env('SERVER_BASE_URL'),
    actionLinkSecret: env('ACTION_LINK_SECRET'),

    zoomAccountId: env('ZOOM_ACCOUNT_ID'),
    zoomClientId: env('ZOOM_CLIENT_ID'),
    zoomClientSecret: env('ZOOM_CLIENT_SECRET'),
    webexBotToken: env('WEBEX_BOT_TOKEN'),
    gotoClientId: env('GOTO_CLIENT_ID'),
    gotoClientSecret: env('GOTO_CLIENT_SECRET'),
    bluejeansApiKey: env('BLUEJEANS_API_KEY'),

    defaultTimezone: envDefault('DEFAULT_TIMEZONE', 'Asia/Kolkata'),
    logicalDayChangeTime,

    publicDir: path.resolve(__dirname, '..', '..', 'public'),
    migrationsDir: path.resolve(__dirname, '..', '..', 'migrations'),

    redisUrl: env('REDIS_URL'),
    eventRetentionDays: envInt('EVENT_RETENTION_DAYS', 90),
  };
}
