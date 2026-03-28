import { describe, it, expect, beforeEach } from 'vitest';

describe('setup.html architecture rules', () => {
  let content;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    content = fs.readFileSync(path.resolve(dir, '../setup.html'), 'utf-8');
  });

  it('does NOT contain Authorization/Bearer', () => {
    expect(content).not.toMatch(/Authorization.*Bearer/i);
  });

  it('does NOT hardcode company names', () => {
    expect(content).not.toMatch(/Shaavir/i);
  });

  it('does NOT hardcode admin emails', () => {
    expect(content).not.toMatch(/@shaavir\.com/i);
  });

  it('does NOT use localStorage for preferences', () => {
    expect(content).not.toMatch(/localStorage\.setItem/);
  });

  it('has all 5 database backends', () => {
    expect(content).toMatch(/value="sqlite"/);
    expect(content).toMatch(/value="postgres"/);
    expect(content).toMatch(/value="azure-tables"/);
    expect(content).toMatch(/value="sharepoint"/);
    expect(content).toMatch(/value="mirrored"/);
  });

  it('has all 9 auth providers', () => {
    expect(content).toMatch(/value="msal"/);
    expect(content).toMatch(/value="google"/);
    expect(content).toMatch(/value="okta"/);
    expect(content).toMatch(/value="teamsSso"/);
    expect(content).toMatch(/value="github"/);
    expect(content).toMatch(/value="saml"/);
    expect(content).toMatch(/value="customJwt"/);
    expect(content).toMatch(/value="magicLink"/);
    expect(content).toMatch(/value="localPin"/);
  });

  it('has admin email and name fields', () => {
    expect(content).toMatch(/id="adminEmail"/);
    expect(content).toMatch(/id="adminName"/);
  });

  it('has company name field', () => {
    expect(content).toMatch(/id="companyName"/);
  });

  it('has timezone selector', () => {
    expect(content).toMatch(/id="defaultTimezone"/);
  });

  it('has connection test button', () => {
    expect(content).toMatch(/id="testBtn"/);
  });

  it('POSTs to /setup/init', () => {
    expect(content).toMatch(/\/setup\/init/);
  });

  it('POSTs to /setup/test', () => {
    expect(content).toMatch(/\/setup\/test/);
  });

  it('redirects to shell.html on completion', () => {
    expect(content).toMatch(/shell\.html/);
  });
});
