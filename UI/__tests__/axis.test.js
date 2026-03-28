import { describe, it, expect, beforeEach } from 'vitest';

describe('axis.html architecture rules', () => {
  let content;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    content = fs.readFileSync(path.resolve(dir, '../axis.html'), 'utf-8');
  });

  it('does NOT use Authorization/Bearer', () => {
    expect(content).not.toMatch(/Authorization.*Bearer/i);
  });

  it('does NOT use postMessage with wildcard', () => {
    expect(content).not.toMatch(/postMessage\([^)]*["']\*["']/);
  });

  it('validates CONTEXT origin', () => {
    expect(content).toMatch(/event\.origin\s*!==\s*window\.location\.origin/);
  });

  it('validates CONTEXT v:1', () => {
    expect(content).toMatch(/ctx\.v\s*!==\s*1/);
  });

  it('does NOT hardcode company names', () => {
    expect(content).not.toMatch(/Shaavir/i);
  });

  it('does NOT write to localStorage', () => {
    expect(content).not.toMatch(/localStorage\.setItem/);
  });

  it('has all 18 settings sections', () => {
    const sections = ['modules', 'attendance', 'members', 'departments', 'shifts', 'leaves',
      'approvals', 'notifications', 'channels', 'digest', 'analytics', 'auth',
      'branding', 'ai', 'storage', 'export', 'compliance', 'integrations'];
    sections.forEach(s => {
      expect(content).toMatch(new RegExp(`data-section="${s}"`));
    });
  });

  it('uses data-setting attributes for auto-binding', () => {
    expect(content).toMatch(/data-setting="/);
  });

  it('uses dotPathToObject for nested settings save', () => {
    expect(content).toMatch(/dotPathToObject/);
  });

  it('uses data-feature for feature toggles', () => {
    expect(content).toMatch(/data-feature="/);
  });

  it('has module toggles with data-module-id', () => {
    expect(content).toMatch(/data-module-id/);
  });

  it('has Members CRUD table', () => {
    expect(content).toMatch(/membersBody/);
    expect(content).toMatch(/\/api\/members/);
  });

  it('has Departments CRUD table', () => {
    expect(content).toMatch(/deptsBody/);
    expect(content).toMatch(/\/api\/groups/);
  });

  it('has Shifts CRUD table', () => {
    expect(content).toMatch(/shiftsBody/);
    expect(content).toMatch(/\/api\/shifts/);
  });

  it('has Approval flow builder', () => {
    expect(content).toMatch(/approvalFlows/);
    expect(content).toMatch(/\/api\/approvals\/flows/);
  });

  it('has Notification matrix', () => {
    expect(content).toMatch(/notificationMatrix/);
    expect(content).toMatch(/\/api\/notifications\/matrix/);
  });

  it('has Auth provider configs', () => {
    expect(content).toMatch(/authProviderConfigs/);
    expect(content).toMatch(/data-auth-provider/);
  });

  it('has AI settings', () => {
    expect(content).toMatch(/data-setting="ai\.provider"/);
    expect(content).toMatch(/data-setting="ai\.model"/);
  });

  it('has Export buttons', () => {
    expect(content).toMatch(/exportAttendance/);
    expect(content).toMatch(/exportLeaves/);
    expect(content).toMatch(/exportLates/);
    expect(content).toMatch(/exportMembers/);
  });

  it('has Audit trail section', () => {
    expect(content).toMatch(/auditTrailContainer/);
    expect(content).toMatch(/\/api\/analytics\/audit/);
  });

  it('has Compliance section', () => {
    expect(content).toMatch(/data-setting="compliance\.region"/);
  });

  it('has Storage info (read-only)', () => {
    expect(content).toMatch(/storageInfo/);
    expect(content).toMatch(/cannot be changed/);
  });

  it('uses httpClient for API calls', () => {
    expect(content).toMatch(/import.*httpClient.*from.*httpClient\.js/);
  });

  it('applies prefs from CONTEXT', () => {
    expect(content).toMatch(/applyPrefsToDOM/);
  });
});
