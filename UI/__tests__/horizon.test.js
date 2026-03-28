import { describe, it, expect, beforeEach } from 'vitest';

describe('horizon.html architecture rules', () => {
  let content;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    content = fs.readFileSync(path.resolve(dir, '../horizon.html'), 'utf-8');
  });

  it('does NOT contain testModeBanner', () => {
    expect(content).not.toMatch(/testModeBanner/i);
  });

  it('does NOT contain _testMode variable', () => {
    expect(content).not.toMatch(/_testMode/);
  });

  it('does NOT contain test-mode API call', () => {
    expect(content).not.toMatch(/test-mode/);
  });

  it('does NOT use Authorization/Bearer', () => {
    expect(content).not.toMatch(/Authorization.*Bearer/i);
  });

  it('does NOT use postMessage with wildcard origin', () => {
    expect(content).not.toMatch(/postMessage\([^)]*["']\*["']/);
  });

  it('validates CONTEXT origin matches window.location.origin', () => {
    expect(content).toMatch(/event\.origin\s*!==\s*window\.location\.origin/);
  });

  it('validates CONTEXT version v:1', () => {
    expect(content).toMatch(/ctx\.v\s*!==\s*1/);
  });

  it('does NOT hardcode company name', () => {
    expect(content).not.toMatch(/Shaavir/i);
  });

  it('does NOT write preferences to localStorage', () => {
    expect(content).not.toMatch(/localStorage\.setItem\(/);
  });

  it('does NOT read preferences from localStorage', () => {
    expect(content).not.toMatch(/localStorage\.getItem\([^)]*theme/i);
    expect(content).not.toMatch(/localStorage\.getItem\([^)]*color/i);
    expect(content).not.toMatch(/localStorage\.getItem\([^)]*bg/i);
  });

  it('reads board refresh interval from settingsCache', () => {
    expect(content).toMatch(/settingsCache\?\.ui\?\.boardRefreshMs/);
  });

  it('reads toast duration from settingsCache', () => {
    expect(content).toMatch(/settingsCache\?\.ui\?\.toastDurationMs/);
  });

  it('reads grid columns from settingsCache', () => {
    expect(content).toMatch(/settingsCache\?\.ui\?\.gridColumns/);
  });

  it('reads status sort order from settingsCache', () => {
    expect(content).toMatch(/settingsCache\?\.ui\?\.statusSortOrder/);
  });

  it('reads clockOutShowMinutes from settingsCache', () => {
    expect(content).toMatch(/settingsCache\?\.attendance\?\.clockOutShowMinutes/);
  });

  it('reads leave types from settingsCache', () => {
    expect(content).toMatch(/settingsCache\?\.leaves\?\.types/);
  });

  it('applies prefs from CONTEXT via applyPrefsToDOM', () => {
    expect(content).toMatch(/applyPrefsToDOM/);
  });

  it('has employee card with data-status attribute', () => {
    expect(content).toMatch(/data-status=/);
  });

  it('has clock-in/out/break/back buttons', () => {
    expect(content).toMatch(/btnClockIn/);
    expect(content).toMatch(/btnClockOut/);
    expect(content).toMatch(/btnBreak/);
    expect(content).toMatch(/btnBack/);
  });

  it('has myDash modal with 6 tabs', () => {
    expect(content).toMatch(/data-panel="dashboard"/);
    expect(content).toMatch(/data-panel="attendance"/);
    expect(content).toMatch(/data-panel="leaves"/);
    expect(content).toMatch(/data-panel="meetings"/);
    expect(content).toMatch(/data-panel="regularization"/);
    expect(content).toMatch(/data-panel="profile"/);
  });

  it('has PAN regex validation', () => {
    expect(content).toMatch(/\[A-Z\]\{5\}\[0-9\]\{4\}\[A-Z\]/);
  });

  it('has Aadhaar auto-format', () => {
    expect(content).toMatch(/profAadhaar/);
    expect(content).toMatch(/\\d\{4\}/);
  });

  it('has IFSC lookup', () => {
    expect(content).toMatch(/\/api\/ifsc\//);
  });

  it('has certification checkbox before profile save', () => {
    expect(content).toMatch(/profCertify/);
  });

  it('has Lottie overlay', () => {
    expect(content).toMatch(/lottieOverlay/);
  });

  it('uses httpClient for API calls', () => {
    expect(content).toMatch(/import.*httpClient.*from.*httpClient\.js/);
  });
});
