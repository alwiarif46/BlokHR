import type { Logger } from 'pino';
import type { AppConfig } from '../../config';
import type { DatabaseEngine } from '../../db/engine';
import { NotificationDispatcher } from './dispatcher';
import { TeamsBotAdapter } from './teams-adapter';
import { SlackAdapter } from './slack-adapter';
import { GoogleChatAdapter } from './google-chat-adapter';
import { ClickUpAdapter } from './clickup-adapter';
import { EmailAdapter } from './email-adapter';
import { DiscordAdapter } from './discord-adapter';
import { WhatsAppAdapter } from './whatsapp-adapter';
import { TelegramAdapter } from './telegram-adapter';

export { NotificationDispatcher } from './dispatcher';
export type { ChannelAdapter, NotificationEvent, NotificationRecipient } from './dispatcher';

/**
 * Creates and configures the notification dispatcher with all channel adapters.
 * Adapters that are not configured (missing env vars) are silently skipped.
 */
export function createNotificationDispatcher(
  config: AppConfig,
  db: DatabaseEngine,
  logger: Logger,
): NotificationDispatcher {
  const dispatcher = new NotificationDispatcher(db, logger);

  // Teams Bot — interactive Adaptive Cards
  dispatcher.registerAdapter(
    new TeamsBotAdapter(config.azureBotAppId, config.azureBotAppPassword, logger),
  );

  // Slack — Block Kit via webhook
  dispatcher.registerAdapter(new SlackAdapter(config.slackBotToken, logger));

  // Google Chat — Card v2 via webhook
  dispatcher.registerAdapter(new GoogleChatAdapter(config.googleChatServiceAccountJson, logger));

  // ClickUp — task/comment creation via API
  dispatcher.registerAdapter(new ClickUpAdapter(config.clickupApiToken, logger));

  // Email — SMTP with one-click action links
  dispatcher.registerAdapter(
    new EmailAdapter(
      config.smtpHost,
      config.smtpPort,
      config.smtpUser,
      config.smtpPass,
      config.smtpFrom,
      config.serverBaseUrl,
      config.actionLinkSecret,
      logger,
    ),
  );

  // Discord — Interactive Bot with buttons
  dispatcher.registerAdapter(
    new DiscordAdapter(config.discordBotToken, config.discordAppId, logger),
  );

  // WhatsApp — Meta Cloud API
  dispatcher.registerAdapter(
    new WhatsAppAdapter(config.whatsappPhoneId, config.whatsappToken, logger),
  );

  // Telegram — Bot API
  dispatcher.registerAdapter(new TelegramAdapter(config.telegramBotToken, logger));

  logger.info({ adapters: dispatcher.adapterCount }, 'Notification dispatcher initialized');
  return dispatcher;
}
