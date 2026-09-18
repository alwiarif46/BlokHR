import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function walkSourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSourceFiles(full));
    else if (/\.(js|html|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('guardian_portal (app shell)', () => {
  /** @type {typeof import('../../modules/guardian_portal/guardian_portal.js')} */
  let portal;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianPatch;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    document.body.className = 'theme-dark guardian-body';
    document.body.innerHTML = '<div id="toasts"></div><div id="guardianRoot"></div>';

    guardianGet = vi.fn(async (p) => {
      if (p.startsWith('/guardian/me/students')) {
        return {
          students: [
            {
              id: 's1',
              firstName: 'Asha',
              lastName: 'Rao',
              class_label: '5',
              section: 'A',
            },
            {
              id: 's2',
              firstName: 'Arun',
              lastName: 'Rao',
              class_label: '3',
              section: 'B',
            },
          ],
        };
      }
      if (p.startsWith('/guardian/reason-codes')) {
        return { reasonCodes: [{ id: 'rc1', code: 'SICK', label: 'Sick' }] };
      }
      if (p.includes('/attendance')) {
        const student = p.includes('s2') ? 's2' : 's1';
        return {
          records: [{ date: '2026-03-02', status: 'present', excuse: 'unknown', reason_bucket: null }],
          monthly: [],
          eligibility_pct: student === 's2' ? 90 : 80,
        };
      }
      if (p === '/guardian/threads') {
        return {
          threads: [
            { id: 'th1', subject: 'Fees', state: 'open', studentRef: 's1' },
            { id: 'th2', subject: 'Bus', state: 'open', studentRef: 's2' },
          ],
        };
      }
      if (p.startsWith('/guardian/threads/')) {
        return {
          thread: { id: 'th1', subject: 'Fees', guardianRef: 'g1' },
          messages: [{ id: 'm1', direction: 'guardian', body: 'Hello' }],
        };
      }
      if (p === '/guardian/surveys') {
        return {
          surveys: [
            {
              id: 'sv1',
              title: 'Parent feedback',
              status: 'active',
              questionsJson: JSON.stringify([
                { key: 'q1', label: 'Happy with school?', type: 'yesno' },
              ]),
            },
          ],
        };
      }
      if (p.startsWith('/guardian/surveys/')) {
        return {
          survey: {
            id: 'sv1',
            title: 'Parent feedback',
            questionsJson: JSON.stringify([
              { key: 'q1', label: 'Happy with school?', type: 'yesno' },
            ]),
          },
        };
      }
      if (p.startsWith('/guardian/diary')) {
        const u = new URL(p, 'http://local');
        const student = u.searchParams.get('student_ref');
        const to = u.searchParams.get('to') || '';
        const today = new Date().toISOString().slice(0, 10);
        if (to && to < today) {
          return {
            entries: [
              {
                id: 'd-old',
                entryDate: '2026-01-20',
                kind: 'note',
                body: 'Earlier note',
                studentRef: student,
                attachmentRefs: null,
                acks: 0,
              },
            ],
          };
        }
        return {
          entries: [
            {
              id: 'd1',
              entryDate: '2026-03-10',
              kind: 'homework',
              body: student === 's2' ? 'Math for Arun' : 'Read ch 3',
              studentRef: null,
              attachmentRefs: ['https://example.com/hw.pdf'],
              acks: 0,
            },
            {
              id: 'd2',
              entryDate: '2026-03-10',
              kind: 'remark',
              body: 'Great effort',
              studentRef: student,
              attachmentRefs: null,
              acks: 0,
            },
          ],
        };
      }
      if (
        p.includes('/report-cards') ||
        p.includes('/assignments') ||
        p.includes('/timetable') ||
        p.includes('/fees') ||
        p.includes('/transport') ||
        p.includes('/library') ||
        p === '/guardian/events' ||
        p === '/guardian/me/profile'
      ) {
        return { _error: true, status: 404, message: 'not found' };
      }
      return {};
    });
    guardianPost = vi.fn(async (p, body) => {
      if (p === '/guardian/login') {
        if (body.password === 'locked') {
          return { _error: true, status: 423, message: 'account locked' };
        }
        if (body.password === 'ambiguous') {
          if (body.tenant_id) {
            return {
              token: 'tok-' + body.tenant_id,
              tenant_id: body.tenant_id,
              guardian_id: body.tenant_id === 't2' ? 'g2' : 'g1',
              expires_at: '2026-04-01T00:00:00.000Z',
            };
          }
          return {
            _error: true,
            status: 409,
            message: 'ambiguous_phone',
            tenants: [
              { tenantId: 't1', guardianId: 'g1' },
              { tenantId: 't2', guardianId: 'g2' },
            ],
          };
        }
        if (body.password !== 'secret123') {
          return { _error: true, status: 401, message: 'invalid credentials' };
        }
        return {
          token: 'tok-abc',
          tenant_id: 't1',
          guardian_id: 'g1',
          expires_at: '2026-04-01T00:00:00.000Z',
        };
      }
      if (p === '/guardian/reported-absences') {
        return { id: 'ra1', merged: false };
      }
      if (p.endsWith('/reply')) {
        return {
          thread: { id: 'th1' },
          message: { id: 'm2', direction: 'guardian', body: body.body },
        };
      }
      if (p === '/guardian/threads') {
        return {
          thread: { id: 'th-new', subject: body.subject, studentRef: body.student_ref },
          message: { id: 'm-new', body: body.body },
        };
      }
      if (p.endsWith('/respond') && p.includes('/guardian/surveys/')) {
        return { response: { id: 'r1' } };
      }
      if (p.includes('/guardian/diary/') && p.endsWith('/ack')) {
        return { ack: { id: 'ack-1', at: '2026-03-10T12:00:00.000Z' } };
      }
      return {};
    });
    guardianPatch = vi.fn(async () => ({ ok: true }));

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      const guardianApi = Object.assign(
        async () => null,
        {
          get: guardianGet,
          post: guardianPost,
          patch: guardianPatch,
        },
      );
      return {
        ...actual,
        guardianApi,
        initApi: () => {},
      };
    });

    portal = await import('../../modules/guardian_portal/guardian_portal.js');
    await portal.bootGuardianPortal(document.getElementById('guardianRoot'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  async function loginAsParent() {
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'secret123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(document.getElementById('gpDiary')).toBeTruthy());
  }

  async function goTo(route) {
    const btn =
      document.querySelector(`#gpNavDesktop [data-route="${route}"]`) ||
      document.querySelector(`[data-route="${route}"]`);
    expect(btn).toBeTruthy();
    btn.click();
    await vi.waitFor(() => {
      expect(btn.classList.contains('active')).toBe(true);
    });
  }

  it('login flow shows lockout message on 423', async () => {
    expect(document.getElementById('gpLoginForm')).toBeTruthy();
    expect(document.querySelector('.login-card')).toBeTruthy();
    expect(document.getElementById('gpApp').hidden).toBe(true);
    expect(document.getElementById('gpHeader').hidden).toBe(true);
    expect(document.body.classList.contains('on-login-screen')).toBe(true);
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'locked';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => {
      const err = document.getElementById('gpLoginError');
      expect(err.classList.contains('show')).toBe(true);
      expect(err.textContent.toLowerCase()).toMatch(/locked/);
    });
  });

  it('ambiguous_phone shows tenant picker then retries with tenant_id', async () => {
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'ambiguous';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(document.querySelector('[data-tenant-id="t2"]')).toBeTruthy());
    document.querySelector('[data-tenant-id="t2"]').click();
    await vi.waitFor(() => expect(document.getElementById('gpDiary')).toBeTruthy());
    expect(guardianPost).toHaveBeenCalledWith(
      '/guardian/login',
      expect.objectContaining({ phone: '9876543210', tenant_id: 't2' }),
    );
  });

  it('nav tabs exist for primary routes', async () => {
    await loginAsParent();
    const routes = portal.NAV_ITEMS.map((n) => n.id);
    expect(routes).toEqual([
      'home',
      'children',
      'learning',
      'attendance',
      'inbox',
      'calendar',
      'payments',
      'transport',
      'forms',
      'documents',
      'more',
    ]);
    for (const id of routes) {
      expect(document.querySelector(`[data-route="${id}"]`)).toBeTruthy();
    }
  });

  it('sibling switch refreshes attendance eligibility for each child', async () => {
    await loginAsParent();
    await goTo('attendance');
    await vi.waitFor(() => expect(document.getElementById('gpElig')).toBeTruthy());
    expect(document.getElementById('gpElig').textContent).toContain('80');

    const sib2 = document.querySelector('[data-student-id="s2"]');
    sib2.click();
    await vi.waitFor(() => {
      expect(document.getElementById('gpElig').textContent).toContain('90');
      expect(document.getElementById('gpAbsenceForm').getAttribute('data-student')).toBe('s2');
    });
    expect(localStorage.getItem('guardian_session')).toBeTruthy();
  });

  it('absence form validates past dates and >15 day spans', () => {
    const past = portal.validateAbsenceForm('2020-01-01', '2020-01-02');
    expect(past.error).toMatch(/today or later/i);
    const long = portal.validateAbsenceForm(
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
    );
    expect(long.error).toMatch(/15/);
  });

  it('thread reply posts via guardianApi', async () => {
    await loginAsParent();
    await goTo('inbox');
    await vi.waitFor(() => expect(document.querySelector('[data-thread-id="th1"]')).toBeTruthy());
    document.querySelector('[data-thread-id="th1"]').click();
    await vi.waitFor(() => expect(document.getElementById('gpReplyForm')).toBeTruthy());
    document.getElementById('gpReplyBody').value = 'Thanks';
    document.getElementById('gpReplyForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => {
      expect(guardianPost).toHaveBeenCalledWith(
        '/guardian/threads/th1/reply',
        expect.objectContaining({ body: 'Thanks' }),
      );
    });
  });

  it('surveys pane lists pending surveys and submits answers', async () => {
    await loginAsParent();
    await goTo('forms');
    await vi.waitFor(() => expect(document.querySelector('[data-survey-id="sv1"]')).toBeTruthy());
    document.querySelector('[data-survey-id="sv1"]').click();
    await vi.waitFor(() => expect(document.getElementById('gpSurveyForm')).toBeTruthy());
    document.querySelector('[data-q="q1"]').value = 'yes';
    document.getElementById('gpSurveyForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => {
      expect(guardianPost).toHaveBeenCalledWith(
        '/guardian/surveys/sv1/respond',
        expect.objectContaining({
          answers: { q1: 'yes' },
          student_ref: 's1',
        }),
      );
    });
  });

  it('diary pane renders grouped feed and switches with child', async () => {
    await loginAsParent();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entry-id="d1"]')).toBeTruthy();
      expect(document.getElementById('gpDiary').textContent).toContain('Read ch 3');
      expect(document.getElementById('gpDiary').textContent).toContain('Homework');
    });
    expect(document.querySelector('.gp-diary-entry.unread')).toBeTruthy();

    document.querySelector('[data-student-id="s2"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('gpDiary').textContent).toContain('Math for Arun');
    });
    expect(guardianGet.mock.calls.some((c) => String(c[0]).includes('student_ref=s2'))).toBe(
      true,
    );
  });

  it('diary Seen ✓ is optimistic and idempotent on re-tap', async () => {
    await loginAsParent();
    await vi.waitFor(() => expect(document.querySelector('[data-ack-id="d1"]')).toBeTruthy());
    const btn = document.querySelector('[data-ack-id="d1"]');
    btn.click();
    await vi.waitFor(() => {
      expect(guardianPost).toHaveBeenCalledWith(
        '/guardian/diary/d1/ack',
        expect.objectContaining({ student_ref: 's1' }),
      );
      expect(document.querySelector('[data-entry-id="d1"].unread')).toBeFalsy();
      expect(document.querySelector('[data-entry-id="d1"] .gp-diary-seen')).toBeTruthy();
    });
    const postsBefore = guardianPost.mock.calls.filter((c) =>
      String(c[0]).includes('/diary/d1/ack'),
    ).length;
    const seen = document.querySelector('[data-entry-id="d1"] .gp-diary-seen');
    expect(seen).toBeTruthy();
    seen.click();
    expect(
      guardianPost.mock.calls.filter((c) => String(c[0]).includes('/diary/d1/ack')).length,
    ).toBe(postsBefore);
  });

  it('diary load earlier extends the date range', async () => {
    await loginAsParent();
    await vi.waitFor(() => expect(document.getElementById('gpDiaryEarlier')).toBeTruthy());
    document.getElementById('gpDiaryEarlier').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entry-id="d-old"]')).toBeTruthy();
      expect(document.getElementById('gpDiary').textContent).toContain('Earlier note');
    });
  });

  it('DoD: no localStorage or raw fetch in guardian_portal module sources', () => {
    const dir = path.resolve(__dirname, '../../modules/guardian_portal');
    const files = walkSourceFiles(dir);
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src.includes('localStorage')).toBe(false);
      expect(src.includes('sessionStorage')).toBe(false);
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
    }
  });

  it('renders two theme buttons from shared catalog', async () => {
    await loginAsParent();
    const { getValidThemes } = await import('../../shared/themes.js');
    const buttons = [...document.querySelectorAll('#gpHdrThemes [data-theme]')];
    expect(buttons.map((b) => b.getAttribute('data-theme'))).toEqual(getValidThemes());
    expect(buttons).toHaveLength(2);
  });

  it('mobile nav shows primary destinations only; desktop has all routes', async () => {
    await loginAsParent();
    const mobileRoutes = [...document.querySelectorAll('#gpNavMobile [data-route]')].map((b) =>
      b.getAttribute('data-route'),
    );
    expect(mobileRoutes).toEqual(portal.PRIMARY_NAV_IDS);
    expect(mobileRoutes).toContain('more');
    expect(mobileRoutes).not.toContain('forms');
    expect(mobileRoutes).not.toContain('learning');

    const desktopRoutes = [...document.querySelectorAll('#gpNavDesktop [data-route]')].map((b) =>
      b.getAttribute('data-route'),
    );
    expect(desktopRoutes).toEqual(portal.NAV_ITEMS.map((n) => n.id));
  });

  it('logout clears session and authenticated DOM', async () => {
    await loginAsParent();
    expect(document.getElementById('gpApp').hidden).toBe(false);
    expect(document.getElementById('gpHeader').hidden).toBe(false);
    expect(localStorage.getItem('guardian_session')).toBeTruthy();
    document.getElementById('gpLogout').click();
    await vi.waitFor(() => expect(document.getElementById('gpLoginForm')).toBeTruthy());
    expect(document.getElementById('gpApp').hidden).toBe(true);
    expect(document.getElementById('gpHeader').hidden).toBe(true);
    expect(document.querySelector('.login-card')).toBeTruthy();
    expect(document.getElementById('gpMain').innerHTML.trim()).toBe('');
    expect(localStorage.getItem('guardian_session')).toBeNull();
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('on-login-screen')).toBe(true);
  });

  it('session expiry event returns to login and clears app', async () => {
    await loginAsParent();
    document.dispatchEvent(new CustomEvent('blokhr:guardian:auth:expired'));
    await vi.waitFor(() => expect(document.getElementById('gpLoginForm')).toBeTruthy());
    expect(document.getElementById('gpApp').hidden).toBe(true);
    expect(localStorage.getItem('guardian_session')).toBeNull();
  });

  it('sibling strip uses tablist when children exist', async () => {
    await loginAsParent();
    const strip = document.getElementById('gpSiblings');
    expect(strip.getAttribute('role')).toBe('tablist');
    expect(strip.querySelectorAll('[role="tab"]').length).toBe(2);
  });

  it('loads account theme from profile and PATCHes merged accessibility on change', async () => {
    guardianGet.mockImplementation(async (p) => {
      if (p === '/guardian/me/profile') {
        return {
          accessibility: { large_text: true, theme: 'light' },
          preferredLanguage: 'en',
        };
      }
      if (p.startsWith('/guardian/me/students')) {
        return {
          students: [
            {
              id: 's1',
              firstName: 'Asha',
              lastName: 'Rao',
              class_label: '5',
              section: 'A',
            },
          ],
        };
      }
      if (p.startsWith('/guardian/reason-codes')) {
        return { reasonCodes: [] };
      }
      if (p.startsWith('/guardian/diary')) {
        return { entries: [] };
      }
      return {};
    });
    guardianPatch.mockResolvedValue({
      accessibility: { large_text: true, theme: 'light' },
    });

    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'secret123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(document.getElementById('gpApp').hidden).toBe(false));
    await vi.waitFor(() => {
      expect(document.body.classList.contains('theme-light')).toBe(true);
      expect(document.body.classList.contains('guardian-body')).toBe(true);
    });

    document.querySelector('#gpHdrThemes [data-theme="dark"]').click();
    await vi.waitFor(() => {
      expect(guardianPatch).toHaveBeenCalledWith(
        '/guardian/me/profile',
        expect.objectContaining({
          accessibility: expect.objectContaining({
            large_text: true,
            theme: 'dark',
          }),
        }),
      );
      expect(document.body.classList.contains('theme-dark')).toBe(true);
    });
  });

  it('reverts theme when profile PATCH fails', async () => {
    await loginAsParent();
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    guardianPatch.mockResolvedValueOnce({
      _error: true,
      status: 500,
      message: 'save failed',
    });
    document.querySelector('#gpHdrThemes [data-theme="light"]').click();
    await vi.waitFor(() => {
      expect(guardianPatch).toHaveBeenCalled();
      expect(document.body.classList.contains('theme-dark')).toBe(true);
      expect(document.body.classList.contains('theme-light')).toBe(false);
    });
  });
});

describe('guardian_portal zero-child and expired session', () => {
  /** @type {typeof import('../../modules/guardian_portal/guardian_portal.js')} */
  let portal;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianPatch;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    document.body.className = 'theme-dark guardian-body';
    document.body.innerHTML = '<div id="toasts"></div><div id="guardianRoot"></div>';

    guardianGet = vi.fn(async (p) => {
      if (p.startsWith('/guardian/me/students')) {
        return { students: [] };
      }
      if (p === '/guardian/me/profile') {
        return { accessibility: {} };
      }
      if (p.startsWith('/guardian/reason-codes')) {
        return { reasonCodes: [] };
      }
      return {};
    });
    guardianPost = vi.fn(async (p, body) => {
      if (p === '/guardian/login') {
        return {
          token: 'tok-empty',
          tenant_id: 't1',
          guardian_id: 'g1',
          expires_at: '2099-04-01T00:00:00.000Z',
        };
      }
      return {};
    });
    guardianPatch = vi.fn(async () => ({ ok: true }));

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      const guardianApi = Object.assign(
        async () => null,
        {
          get: guardianGet,
          post: guardianPost,
          patch: guardianPatch,
        },
      );
      return {
        ...actual,
        guardianApi,
        initApi: () => {},
      };
    });

    portal = await import('../../modules/guardian_portal/guardian_portal.js');
    await portal.bootGuardianPortal(document.getElementById('guardianRoot'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows no-linked-children empty state and disables child-scoped nav', async () => {
    document.getElementById('gpPhone').value = '7889371066';
    document.getElementById('gpPassword').value = 'admin123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => {
      expect(document.getElementById('gpChildrenList')).toBeTruthy();
    });
    expect(document.getElementById('gpChildrenList').textContent).toMatch(/No linked children/i);
    expect(document.getElementById('gpSiblings').hidden).toBe(true);
    expect(document.getElementById('gpApp').dataset.accountMode).toBe('no_children');

    const attendance = document.querySelector('#gpNavDesktop [data-route="attendance"]');
    expect(attendance.disabled).toBe(true);
    const children = document.querySelector('#gpNavDesktop [data-route="children"]');
    expect(children.disabled).toBe(false);
    const more = document.querySelector('#gpNavDesktop [data-route="more"]');
    expect(more.disabled).toBe(false);
  });

  it('ignores expired stored session and stays on login', async () => {
    localStorage.setItem(
      'guardian_session',
      JSON.stringify({
        token: 'expired-tok',
        tenantId: 't1',
        guardianId: 'g1',
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    );
    vi.resetModules();
    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      const guardianApi = Object.assign(
        async () => null,
        {
          get: guardianGet,
          post: guardianPost,
          patch: guardianPatch,
        },
      );
      return { ...actual, guardianApi, initApi: () => {} };
    });
    document.body.innerHTML = '<div id="toasts"></div><div id="guardianRoot"></div>';
    portal = await import('../../modules/guardian_portal/guardian_portal.js');
    await portal.bootGuardianPortal(document.getElementById('guardianRoot'));
    expect(document.getElementById('gpLoginForm')).toBeTruthy();
    expect(document.getElementById('gpApp').hidden).toBe(true);
    expect(localStorage.getItem('guardian_session')).toBeNull();
    expect(guardianGet).not.toHaveBeenCalled();
  });
});
