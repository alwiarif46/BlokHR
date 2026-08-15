import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set required vars so base case passes
    process.env.AZURE_BLOB_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Optional vars: no longer fail-fast ──

  it('does NOT throw when AZURE_BLOB_CONNECTION_STRING is missing (now optional)', () => {
    delete process.env.AZURE_BLOB_CONNECTION_STRING;
    expect(() => loadConfig()).not.toThrow();
    const c = loadConfig();
    expect(c.azureBlobConnectionString).toBe('');
  });

  it('loads AZURE_BLOB_CONNECTION_STRING when provided', () => {
    process.env.AZURE_BLOB_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test';
    const c = loadConfig();
    expect(c.azureBlobConnectionString).toBe('DefaultEndpointsProtocol=https;AccountName=test');
  });

  // ── Defaults ──

  it('uses default port 3000 when PORT is not set', () => {
    delete process.env.PORT;
    const config = loadConfig();
    expect(config.port).toBe(3000);
  });

  it('parses PORT as integer', () => {
    process.env.PORT = '8080';
    const config = loadConfig();
    expect(config.port).toBe(8080);
  });

  it('throws on non-integer PORT', () => {
    process.env.PORT = 'abc';
    expect(() => loadConfig()).toThrow('must be an integer');
  });

  it('defaults DB_ENGINE to sqlite', () => {
    delete process.env.DB_ENGINE;
    const config = loadConfig();
    expect(config.dbEngine).toBe('sqlite');
  });

  it('accepts postgres as DB_ENGINE', () => {
    process.env.DB_ENGINE = 'postgres';
    const config = loadConfig();
    expect(config.dbEngine).toBe('postgres');
  });

  it('throws on invalid DB_ENGINE', () => {
    process.env.DB_ENGINE = 'mysql';
    expect(() => loadConfig()).toThrow('DB_ENGINE must be "sqlite" or "postgres"');
  });

  it('defaults NODE_ENV to production', () => {
    delete process.env.NODE_ENV;
    const config = loadConfig();
    expect(config.nodeEnv).toBe('production');
  });

  it('defaults LOG_LEVEL to info', () => {
    delete process.env.LOG_LEVEL;
    const config = loadConfig();
    expect(config.logLevel).toBe('info');
  });

  it('defaults CORS_ORIGINS to *', () => {
    delete process.env.CORS_ORIGINS;
    const config = loadConfig();
    expect(config.corsOrigins).toBe('*');
  });

  it('defaults AZURE_BLOB_CONTAINER to shaavir-files', () => {
    delete process.env.AZURE_BLOB_CONTAINER;
    const config = loadConfig();
    expect(config.azureBlobContainer).toBe('shaavir-files');
  });

  it('defaults SMTP_PORT to 587', () => {
    delete process.env.SMTP_PORT;
    const config = loadConfig();
    expect(config.smtpPort).toBe(587);
  });

  it('defaults DEFAULT_TIMEZONE to Asia/Kolkata', () => {
    delete process.env.DEFAULT_TIMEZONE;
    const config = loadConfig();
    expect(config.defaultTimezone).toBe('Asia/Kolkata');
  });

  it('defaults LOGICAL_DAY_CHANGE_TIME to 06:00', () => {
    delete process.env.LOGICAL_DAY_CHANGE_TIME;
    const config = loadConfig();
    expect(config.logicalDayChangeTime).toBe('06:00');
  });

  // ── LLM_PROVIDER validation ──

  it('accepts anthropic as LLM_PROVIDER', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    const config = loadConfig();
    expect(config.llmProvider).toBe('anthropic');
  });

  it('accepts ollama as LLM_PROVIDER', () => {
    process.env.LLM_PROVIDER = 'ollama';
    const config = loadConfig();
    expect(config.llmProvider).toBe('ollama');
  });

  it('returns undefined llmProvider when not set', () => {
    delete process.env.LLM_PROVIDER;
    const config = loadConfig();
    expect(config.llmProvider).toBeUndefined();
  });

  it('throws on invalid LLM_PROVIDER', () => {
    process.env.LLM_PROVIDER = 'openai';
    expect(() => loadConfig()).toThrow('LLM_PROVIDER must be "anthropic" or "ollama"');
  });

  // ── LOGICAL_DAY_CHANGE_TIME format validation ──

  it('accepts valid HH:MM format for LOGICAL_DAY_CHANGE_TIME', () => {
    process.env.LOGICAL_DAY_CHANGE_TIME = '05:30';
    const config = loadConfig();
    expect(config.logicalDayChangeTime).toBe('05:30');
  });

  it('throws on invalid LOGICAL_DAY_CHANGE_TIME format', () => {
    process.env.LOGICAL_DAY_CHANGE_TIME = '5:30';
    expect(() => loadConfig()).toThrow('HH:MM format');
  });

  it('throws on garbage LOGICAL_DAY_CHANGE_TIME', () => {
    process.env.LOGICAL_DAY_CHANGE_TIME = 'morning';
    expect(() => loadConfig()).toThrow('HH:MM format');
  });

  // ── Optional vars: undefined when not set ──

  it('returns undefined for optional vars when not set', () => {
    const config = loadConfig();
    expect(config.azureBotAppId).toBeUndefined();
    expect(config.azureBotAppPassword).toBeUndefined();
    expect(config.slackBotToken).toBeUndefined();
    expect(config.slackSigningSecret).toBeUndefined();
    expect(config.googleChatServiceAccountJson).toBeUndefined();
    expect(config.clickupApiToken).toBeUndefined();
    expect(config.discordBotToken).toBeUndefined();
    expect(config.discordAppId).toBeUndefined();
    expect(config.whatsappPhoneId).toBeUndefined();
    expect(config.whatsappToken).toBeUndefined();
    expect(config.telegramBotToken).toBeUndefined();
    expect(config.smtpHost).toBeUndefined();
    expect(config.smtpUser).toBeUndefined();
    expect(config.smtpPass).toBeUndefined();
    expect(config.smtpFrom).toBeUndefined();
    expect(config.llmApiKey).toBeUndefined();
    expect(config.llmBaseUrl).toBeUndefined();
    expect(config.llmModel).toBeUndefined();
    expect(config.azureFaceEndpoint).toBeUndefined();
    expect(config.azureFaceKey).toBeUndefined();
    expect(config.serverBaseUrl).toBeUndefined();
    expect(config.actionLinkSecret).toBeUndefined();
  });

  // ── Optional vars: populated when set ──

  it('reads optional vars when set', () => {
    process.env.AZURE_BOT_APP_ID = 'bot-id-123';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.LLM_API_KEY = 'sk-test-key';
    const config = loadConfig();
    expect(config.azureBotAppId).toBe('bot-id-123');
    expect(config.slackBotToken).toBe('xoxb-test-token');
    expect(config.llmApiKey).toBe('sk-test-key');
  });

  // ── Whitespace trimming ──

  it('trims whitespace from env vars', () => {
    process.env.AZURE_BLOB_CONNECTION_STRING = '  conn-string-with-spaces  ';
    process.env.PORT = ' 4000 ';
    const config = loadConfig();
    expect(config.azureBlobConnectionString).toBe('conn-string-with-spaces');
    expect(config.port).toBe(4000);
  });

  // ── Treats empty string as unset ──

  it('treats empty string as unset for optional vars', () => {
    process.env.SLACK_WEBHOOK_URL = '';
    const config = loadConfig();
    expect(config.slackBotToken).toBeUndefined();
    expect(config.slackSigningSecret).toBeUndefined();
  });

  it('returns empty string when AZURE_BLOB_CONNECTION_STRING is empty', () => {
    process.env.AZURE_BLOB_CONNECTION_STRING = '';
    const config = loadConfig();
    expect(config.azureBlobConnectionString).toBe('');
  });

  // ── Path fields ──

  it('sets publicDir and migrationsDir as absolute paths', () => {
    const config = loadConfig();
    expect(config.publicDir).toMatch(/public$/);
    expect(config.migrationsDir).toMatch(/migrations$/);
    expect(config.publicDir.startsWith('/')).toBe(true);
    expect(config.migrationsDir.startsWith('/')).toBe(true);
  });
});
