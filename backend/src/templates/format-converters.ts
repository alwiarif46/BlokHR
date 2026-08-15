/**
 * Format converters: NotificationMessage → platform-native format.
 * Each adapter calls the relevant converter instead of building templates internally.
 * Adding a new module only requires updating notification-message.ts — these converters are generic.
 */

import type { NotificationMessage } from './notification-message';

// ── TEAMS ADAPTIVE CARD ──

export function toAdaptiveCard(msg: NotificationMessage): Record<string, unknown> {
  const card: Record<string, unknown> = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [{ type: 'TextBlock', text: msg.icon, size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: msg.title, weight: 'Bolder', size: 'Medium' },
              ...(msg.subtitle
                ? [{ type: 'TextBlock', text: msg.subtitle, spacing: 'None', isSubtle: true }]
                : []),
            ],
          },
        ],
      },
      {
        type: 'FactSet',
        facts: msg.fields.map((f) => ({ title: f.label, value: f.value })),
      },
      ...(msg.bodyText
        ? [
            {
              type: 'TextBlock',
              text: `_${msg.bodyText}_`,
              isSubtle: true,
              wrap: true,
              size: 'Small',
            },
          ]
        : []),
    ],
  };

  if (msg.buttons.length > 0) {
    card.actions = msg.buttons.map((b) => ({
      type: 'Action.Execute',
      title: b.label,
      verb: b.actionId,
      data: b.payload,
      style: b.style === 'primary' ? 'positive' : 'destructive',
    }));
  }

  return card;
}

// ── SLACK BLOCK KIT ──

export function toSlackBlocks(msg: NotificationMessage): {
  text: string;
  blocks: Array<Record<string, unknown>>;
} {
  const fieldsMrkdwn = msg.fields.map((f) => ({
    type: 'mrkdwn',
    text: `*${f.label}:* ${f.value}`,
  }));
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${msg.icon} *${msg.title}*${msg.subtitle ? `\n${msg.subtitle}` : ''}`,
      },
    },
  ];

  if (fieldsMrkdwn.length > 0) {
    // Slack limits to 10 fields per section
    for (let i = 0; i < fieldsMrkdwn.length; i += 10) {
      blocks.push({ type: 'section', fields: fieldsMrkdwn.slice(i, i + 10) });
    }
  }

  if (msg.bodyText) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `_${msg.bodyText}_` } });
  }

  if (msg.buttons.length > 0) {
    blocks.push({
      type: 'actions',
      elements: msg.buttons.map((b) => ({
        type: 'button',
        text: { type: 'plain_text', text: b.label },
        style: b.style === 'primary' ? 'primary' : 'danger',
        action_id: b.actionId,
        value: JSON.stringify(b.payload),
      })),
    });
  }

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `_${msg.footerText}_` }] });

  return { text: `${msg.icon} ${msg.title} - ${msg.subtitle}`, blocks };
}

// ── GOOGLE CHAT CARD V2 ──

export function toGoogleChatCard(
  msg: NotificationMessage,
  cardId: string,
): Record<string, unknown> {
  const widgets: Array<Record<string, unknown>> = msg.fields.map((f) => ({
    decoratedText: { topLabel: f.label, text: f.value },
  }));

  if (msg.bodyText) {
    widgets.push({ textParagraph: { text: `<i>${msg.bodyText}</i>` } });
  }

  const sections: Array<Record<string, unknown>> = [{ widgets }];

  if (msg.buttons.length > 0) {
    sections.push({
      widgets: [
        {
          buttonList: {
            buttons: msg.buttons.map((b) => ({
              text: b.label,
              onClick: {
                action: {
                  function: b.actionId,
                  parameters: Object.entries(b.payload).map(([key, value]) => ({
                    key,
                    value: String(value),
                  })),
                },
              },
            })),
          },
        },
      ],
    });
  }

  sections.push({
    widgets: [{ textParagraph: { text: `<font color="#999">${msg.footerText}</font>` } }],
  });

  return {
    cardsV2: [
      {
        cardId,
        card: {
          header: { title: `${msg.icon} ${msg.title}`, subtitle: msg.subtitle },
          sections,
        },
      },
    ],
  };
}

// ── DISCORD EMBED + COMPONENTS ──

export function toDiscordMessage(msg: NotificationMessage): {
  content: string;
  embeds: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
} {
  const hexToInt = (hex: string): number => parseInt(hex.replace('#', ''), 16);

  const embed: Record<string, unknown> = {
    title: `${msg.icon} ${msg.title}`,
    description: msg.subtitle || undefined,
    color: hexToInt(msg.color),
    fields: msg.fields.map((f) => ({ name: f.label, value: f.value, inline: f.value.length < 30 })),
    footer: { text: msg.footerText },
    timestamp: new Date().toISOString(),
  };

  if (msg.bodyText) {
    (embed.fields as Array<Record<string, unknown>>).push({
      name: '\u200b',
      value: `_${msg.bodyText}_`,
      inline: false,
    });
  }

  const components: Array<Record<string, unknown>> = [];
  if (msg.buttons.length > 0) {
    components.push({
      type: 1,
      components: msg.buttons.map((b) => ({
        type: 2,
        style: b.style === 'primary' ? 3 : 4,
        label: b.label,
        custom_id: JSON.stringify({ action: b.actionId, ...b.payload }),
      })),
    });
  }

  return { content: '', embeds: [embed], components };
}

// ── EMAIL HTML ──

export function toEmailHtml(
  msg: NotificationMessage,
  actionUrls?: { approve?: string; reject?: string },
): { subject: string; html: string } {
  const primaryColor = msg.color || '#F5A623';

  const rows = msg.fields
    .map(
      (f) =>
        `<tr><td style="padding:8px 12px;color:#666;font-size:13px;border-bottom:1px solid #eee"><strong>${f.label}</strong></td><td style="padding:8px 12px;border-bottom:1px solid #eee">${f.value}</td></tr>`,
    )
    .join('');

  const details = rows
    ? `<table style="border-collapse:collapse;margin:16px 0;width:100%">${rows}</table>`
    : '';

  let buttons = '';
  if (actionUrls?.approve && actionUrls?.reject) {
    const approveLabel = msg.buttons.find((b) => b.style === 'primary')?.label ?? 'Approve';
    buttons = `
      <div style="margin:20px 0;text-align:center">
        <a href="${actionUrls.approve}" style="display:inline-block;padding:12px 32px;background:${primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;margin-right:12px">${approveLabel}</a>
        <a href="${actionUrls.reject}" style="display:inline-block;padding:12px 32px;background:#EF4444;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">&#10007; Reject</a>
      </div>`;
  }

  const body = msg.bodyText ? `<p style="color:#666">${msg.bodyText}</p>` : '';

  return {
    subject: `${msg.icon} ${msg.title} - ${msg.subtitle}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333">
      <h2 style="color:${primaryColor}">${msg.title}</h2>
      <p>${msg.subtitle}</p>
      ${details}${body}${buttons}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:11px;color:#999;text-align:center">${msg.footerText}</p>
    </div>`,
  };
}

// ── TELEGRAM HTML + INLINE KEYBOARD ──

export function toTelegramMessage(msg: NotificationMessage): {
  text: string;
  reply_markup?: Record<string, unknown>;
} {
  const fieldsHtml = msg.fields.map((f) => `<b>${f.label}:</b> ${f.value}`).join('\n');

  const text = [
    `${msg.icon} <b>${msg.title}</b>`,
    msg.subtitle || '',
    '',
    fieldsHtml,
    msg.bodyText ? `\n<i>${msg.bodyText}</i>` : '',
    '',
    `<i>${msg.footerText}</i>`,
  ]
    .filter(Boolean)
    .join('\n');

  if (msg.buttons.length > 0) {
    return {
      text,
      reply_markup: {
        inline_keyboard: [
          msg.buttons.map((b) => ({
            text: b.label,
            callback_data: JSON.stringify({ a: b.actionId, ...b.payload }),
          })),
        ],
      },
    };
  }

  return { text };
}

// ── WHATSAPP INTERACTIVE ──

export function toWhatsAppMessage(
  msg: NotificationMessage,
  phone: string,
): Record<string, unknown> {
  const bodyText = [
    msg.subtitle,
    '',
    ...msg.fields.map((f) => `${f.label}: ${f.value}`),
    msg.bodyText ? `\n${msg.bodyText}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (msg.buttons.length > 0) {
    return {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: `${msg.icon} ${msg.title}` },
        body: { text: bodyText },
        action: {
          buttons: msg.buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: JSON.stringify(b.payload), title: b.label.substring(0, 20) },
          })),
        },
      },
    };
  }

  return {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: `${msg.icon} ${msg.title}\n\n${bodyText}` },
  };
}

// ── CLICKUP ──

export function toClickUpTask(msg: NotificationMessage): { name: string; description: string } {
  const description = [
    msg.subtitle,
    '',
    ...msg.fields.map((f) => `**${f.label}:** ${f.value}`),
    msg.bodyText ? `\n_${msg.bodyText}_` : '',
    '',
    '---',
    `_${msg.footerText}_`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    name: `${msg.icon} ${msg.title}`,
    description,
  };
}
