import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toClickUpTask } from '../../templates/format-converters';

/**
 * ClickUp adapter — uses shared template system.
 * Supports all modules automatically.
 * Creates tasks on submission, posts comments on status changes.
 */
export class ClickUpAdapter implements ChannelAdapter {
  readonly name = 'clickup';
  readonly isConfigured: boolean;

  private readonly apiToken: string;
  private readonly logger: Logger;
  private readonly apiBase = 'https://api.clickup.com/api/v2';

  constructor(apiToken: string | undefined, logger: Logger) {
    this.apiToken = apiToken ?? '';
    this.isConfigured = !!this.apiToken;
    this.logger = logger;
  }

  private async apiRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
    try {
      const resp = await fetch(`${this.apiBase}${path}`, {
        method,
        headers: { Authorization: this.apiToken, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { ok: false, error: `ClickUp ${method} ${path}: ${resp.status} ${text}` };
      }
      const data = (await resp.json()) as Record<string, unknown>;
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async send(
    recipient: NotificationRecipient,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    cardReference?: string;
    conversationId?: string;
    error?: string;
  }> {
    if (!this.isConfigured) return { success: false, error: 'ClickUp not configured' };

    const listId = (data.clickupListId as string) ?? '';
    const existingTaskId = (data.clickupTaskId as string) ?? '';

    const msg = buildNotificationMessage(templateName, data, recipient.role);

    // Status updates on existing tasks — post comment
    if (existingTaskId && !templateName.endsWith(':submitted')) {
      const taskContent = toClickUpTask(msg);
      const result = await this.apiRequest('POST', `/task/${existingTaskId}/comment`, {
        comment_text: `${taskContent.name}\n\n${taskContent.description}`,
      });
      if (!result.ok) return { success: false, error: result.error };

      // Update task status for resolved events
      if (msg.isResolved) {
        const status = (data.status as string) ?? '';
        const statusMap: Record<string, string> = {
          Approved: 'approved',
          approved: 'approved',
          Rejected: 'rejected',
          rejected: 'rejected',
          'Approved by Manager': 'manager approved',
          manager_approved: 'manager approved',
        };
        const newStatus = statusMap[status];
        if (newStatus) {
          await this.apiRequest('PUT', `/task/${existingTaskId}`, { status: newStatus });
        }
      }

      this.logger.info(
        { recipient: recipient.email, template: templateName, taskId: existingTaskId },
        'ClickUp comment posted',
      );
      return { success: true, cardReference: existingTaskId };
    }

    // New submissions — create a task
    if (!listId) return { success: false, error: 'No clickupListId configured' };

    const taskContent = toClickUpTask(msg);
    const entityId = (data.leaveId as string) ?? (data.regId as string) ?? '';

    const result = await this.apiRequest('POST', `/list/${listId}/task`, {
      name: taskContent.name,
      description: taskContent.description + '\n\nChange task status to approve/reject.',
      status: 'pending',
      tags: ['approval-workflow', `entity-${entityId}`],
    });
    if (!result.ok) return { success: false, error: result.error };

    const taskId = (result.data?.id as string) ?? '';
    this.logger.info(
      { recipient: recipient.email, template: templateName, taskId },
      'ClickUp task created',
    );
    return { success: true, cardReference: taskId, conversationId: listId };
  }

  async updateCard(
    _conversationId: string,
    cardReference: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) return { success: false, error: 'ClickUp not configured' };

    const msg = buildNotificationMessage(templateName, data);
    const taskContent = toClickUpTask(msg);

    const commentResult = await this.apiRequest('POST', `/task/${cardReference}/comment`, {
      comment_text: `Status update: ${taskContent.name}`,
    });
    if (!commentResult.ok) return { success: false, error: commentResult.error };

    const status = (data.status as string) ?? '';
    const statusMap: Record<string, string> = {
      Approved: 'approved',
      approved: 'approved',
      Rejected: 'rejected',
      rejected: 'rejected',
      'Approved by Manager': 'manager approved',
      manager_approved: 'manager approved',
    };
    const newStatus = statusMap[status];
    if (newStatus) {
      await this.apiRequest('PUT', `/task/${cardReference}`, { status: newStatus });
    }

    this.logger.info({ taskId: cardReference, template: templateName }, 'ClickUp task updated');
    return { success: true };
  }
}
