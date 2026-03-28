import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
let aiContent, kioskContent;

beforeAll(() => {
  aiContent = readFileSync(resolve(dir, '../ai-assistant.html'), 'utf-8');
  kioskContent = readFileSync(resolve(dir, '../kiosk.html'), 'utf-8');
});

describe('ai-assistant.html', () => {
  it('does NOT use Authorization/Bearer', () => {
    expect(aiContent).not.toMatch(/Authorization.*Bearer/i);
  });

  it('validates CONTEXT origin and v:1', () => {
    expect(aiContent).toMatch(/event\.origin\s*!==\s*window\.location\.origin/);
    expect(aiContent).toMatch(/ctx\.v\s*!==\s*1/);
  });

  it('does NOT hardcode company names', () => {
    expect(aiContent).not.toMatch(/Shaavir/i);
  });

  it('does NOT write to localStorage', () => {
    expect(aiContent).not.toMatch(/localStorage\.setItem/);
  });

  it('calls /api/copilot/chat for messages', () => {
    expect(aiContent).toMatch(/\/api\/copilot\/chat/);
  });

  it('loads chat history from /api/copilot/history', () => {
    expect(aiContent).toMatch(/\/api\/copilot\/history/);
  });

  it('uses httpClient', () => {
    expect(aiContent).toMatch(/import.*httpClient.*from.*httpClient\.js/);
  });

  it('applies prefs from CONTEXT', () => {
    expect(aiContent).toMatch(/applyPrefsToDOM/);
  });

  it('has send button and input', () => {
    expect(aiContent).toMatch(/id="sendBtn"/);
    expect(aiContent).toMatch(/id="userInput"/);
  });

  it('has suggestion chips', () => {
    expect(aiContent).toMatch(/suggestion-chip/);
  });

  it('has typing indicator', () => {
    expect(aiContent).toMatch(/msg-typing/);
  });

  it('reads AI persona from settings', () => {
    expect(aiContent).toMatch(/settingsCache\?\.ai\?\.persona/);
  });
});

describe('kiosk.html', () => {
  it('does NOT use Authorization/Bearer', () => {
    expect(kioskContent).not.toMatch(/Authorization.*Bearer/i);
  });

  it('validates CONTEXT origin and v:1', () => {
    expect(kioskContent).toMatch(/event\.origin\s*!==\s*window\.location\.origin/);
    expect(kioskContent).toMatch(/ctx\.v\s*!==\s*1/);
  });

  it('does NOT hardcode company names', () => {
    expect(kioskContent).not.toMatch(/Shaavir/i);
  });

  it('does NOT write to localStorage', () => {
    expect(kioskContent).not.toMatch(/localStorage\.setItem/);
  });

  it('has PIN pad with digits 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(kioskContent).toMatch(new RegExp(`data-key="${i}"`));
    }
  });

  it('has clear and enter keys', () => {
    expect(kioskContent).toMatch(/data-key="clear"/);
    expect(kioskContent).toMatch(/data-key="enter"/);
  });

  it('has clock action buttons', () => {
    expect(kioskContent).toMatch(/data-action="in"/);
    expect(kioskContent).toMatch(/data-action="break"/);
    expect(kioskContent).toMatch(/data-action="back"/);
    expect(kioskContent).toMatch(/data-action="out"/);
  });

  it('POSTs to /api/clock/kiosk', () => {
    expect(kioskContent).toMatch(/\/api\/clock\/kiosk/);
  });

  it('reads platform name from settings', () => {
    expect(kioskContent).toMatch(/settingsCache\?\.tenant\?\.platformName/);
  });

  it('reads logo from settings', () => {
    expect(kioskContent).toMatch(/settingsCache\?\.tenant\?\.logoDataUrl/);
  });

  it('uses httpClient', () => {
    expect(kioskContent).toMatch(/import.*httpClient.*from.*httpClient\.js/);
  });

  it('has 4 PIN dots', () => {
    expect(kioskContent).toMatch(/id="dot0"/);
    expect(kioskContent).toMatch(/id="dot3"/);
  });
});
