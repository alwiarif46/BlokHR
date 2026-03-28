import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const modules = ['apex', 'nebula', 'meridian', 'zenith', 'vector', 'nova'];

const contents = {};
beforeAll(() => {
  modules.forEach(m => {
    contents[m] = readFileSync(resolve(dir, `../${m}.html`), 'utf-8');
  });
});

describe.each(modules)('%s.html architecture rules', (mod) => {
  it('does NOT use Authorization/Bearer', () => {
    expect(contents[mod]).not.toMatch(/Authorization.*Bearer/i);
  });

  it('does NOT use postMessage with wildcard', () => {
    expect(contents[mod]).not.toMatch(/postMessage\([^)]*["']\*["']/);
  });

  it('validates CONTEXT origin', () => {
    expect(contents[mod]).toMatch(/event\.origin\s*!==\s*window\.location\.origin/);
  });

  it('validates CONTEXT v:1', () => {
    expect(contents[mod]).toMatch(/ctx\.v\s*!==\s*1/);
  });

  it('does NOT hardcode company names', () => {
    expect(contents[mod]).not.toMatch(/Shaavir/i);
  });

  it('does NOT write to localStorage', () => {
    expect(contents[mod]).not.toMatch(/localStorage\.setItem/);
  });

  it('does NOT read preferences from localStorage', () => {
    expect(contents[mod]).not.toMatch(/localStorage\.getItem\([^)]*theme/i);
  });

  it('uses httpClient for API calls', () => {
    expect(contents[mod]).toMatch(/import.*httpClient.*from.*httpClient\.js/);
  });

  it('applies prefs from CONTEXT', () => {
    expect(contents[mod]).toMatch(/applyPrefsToDOM/);
  });

  it('has a search input or is a dashboard', () => {
    if (mod === 'zenith') return; // live dashboard, no search
    expect(contents[mod]).toMatch(/searchInput|tracker-search/);
  });

  it('links to design-system.css', () => {
    expect(contents[mod]).toMatch(/design-system\.css/);
  });
});

describe('Module page specifics', () => {
  it('apex has BD pipeline stages', () => {
    expect(contents.apex).toMatch(/Lead.*Proposal.*Negotiation/s);
  });

  it('nebula has PD program types', () => {
    expect(contents.nebula).toMatch(/course|certification|workshop/);
  });

  it('meridian has RD phases', () => {
    expect(contents.meridian).toMatch(/Research.*Prototype.*Testing/s);
  });

  it('zenith has live dashboard cards', () => {
    expect(contents.zenith).toMatch(/live-card/);
    expect(contents.zenith).toMatch(/live-indicator/);
  });

  it('vector has task kanban columns', () => {
    expect(contents.vector).toMatch(/Todo.*In Progress.*Review.*Done/s);
  });

  it('nova has dev issue types', () => {
    expect(contents.nova).toMatch(/bug.*feature.*improvement/s);
    expect(contents.nova).toMatch(/sprint/i);
  });
});
