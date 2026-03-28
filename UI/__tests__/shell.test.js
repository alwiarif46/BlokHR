import { describe, it, expect, beforeEach } from 'vitest';

describe('shell.html architecture rules', () => {
  let shellContent;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    shellContent = fs.readFileSync(path.resolve(dir, '../shell.html'), 'utf-8');
  });

  it('does NOT contain Authorization/Bearer header', () => {
    expect(shellContent).not.toMatch(/Authorization.*Bearer/i);
    expect(shellContent).not.toMatch(/['"]Bearer /);
  });

  it('does NOT use postMessage with wildcard origin', () => {
    expect(shellContent).not.toMatch(/postMessage\([^)]*,\s*["']\*["']/);
  });

  it('uses SAFE_ORIGIN for postMessage', () => {
    expect(shellContent).toMatch(/postMessage\([\s\S]*?,\s*SAFE_ORIGIN/);
  });

  it('does NOT hardcode company name in visible text', () => {
    // Check that "Shaavir" or "shaavir" doesn't appear as hardcoded text
    expect(shellContent).not.toMatch(/Shaavir/i);
  });

  it('does NOT hardcode admin emails', () => {
    expect(shellContent).not.toMatch(/@shaavir\.com/i);
    expect(shellContent).not.toMatch(/@company\.com/i);
  });

  it('does NOT hardcode timezones', () => {
    expect(shellContent).not.toMatch(/Asia\/Kolkata/);
    expect(shellContent).not.toMatch(/\bIST\b/);
  });

  it('does NOT write preferences to localStorage', () => {
    // Only session_${tenantId} should be in localStorage writes
    const setItemMatches = shellContent.match(/localStorage\.setItem\([^)]+\)/g) || [];
    setItemMatches.forEach(match => {
      expect(match).toMatch(/session_/);
    });
  });

  it('loads preferences from server via GET /api/profiles/me/prefs', () => {
    expect(shellContent).toMatch(/loadPrefs/);
  });

  it('saves preferences via savePref (PUT /api/profiles/me/prefs)', () => {
    expect(shellContent).toMatch(/savePref\(/);
  });

  it('uses iframe with ?iframe=1 query parameter', () => {
    expect(shellContent).toMatch(/\?iframe=1/);
  });

  it('CONTEXT protocol has v:1', () => {
    expect(shellContent).toMatch(/v:\s*1/);
  });

  it('tabs are rendered from settings, not hardcoded', () => {
    expect(shellContent).toMatch(/settingsCache\?\.tabs/);
    // No hardcoded tab names in the HTML
    expect(shellContent).not.toMatch(/<button[^>]*>Horizon<\/button>/);
    expect(shellContent).not.toMatch(/<button[^>]*>Axis<\/button>/);
  });

  it('login buttons are rendered from provider config, not hardcoded', () => {
    expect(shellContent).toMatch(/renderLoginButtons/);
    expect(shellContent).toMatch(/providers/);
  });

  it('has gear panel with theme, dark mode, and colour settings', () => {
    expect(shellContent).toMatch(/themeGrid/);
    expect(shellContent).toMatch(/darkModeRow/);
    expect(shellContent).toMatch(/data-css-var/);
  });

  it('connects to SSE', () => {
    expect(shellContent).toMatch(/connectSSE/);
  });

  it('has admin-only branding section', () => {
    expect(shellContent).toMatch(/admin-only/);
    expect(shellContent).toMatch(/adminPlatformName/);
  });
});
