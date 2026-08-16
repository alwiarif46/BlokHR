import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('guardian_portal (P9-04)', () => {
  /** @type {typeof import('../../modules/guardian_portal/guardian_portal.js')} */
  let portal;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let guardianPost;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
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
        // "Load earlier" uses to = previous from (< today)
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
      return {};
    });
    guardianPost = vi.fn(async (p, body) => {
      if (p === '/guardian/login') {
        if (body.password === 'locked') {
          return { _error: true, status: 423, message: 'account locked' };
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

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      const guardianApi = Object.assign(
        async () => null,
        {
          get: guardianGet,
          post: guardianPost,
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
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('login flow shows lockout message on 423', async () => {
    expect(document.getElementById('gpLoginForm')).toBeTruthy();
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'locked';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => {
      const err = document.getElementById('gpLoginError');
      expect(err.hidden).toBe(false);
      expect(err.textContent.toLowerCase()).toMatch(/locked/);
    });
  });

  it('sibling switch refreshes attendance eligibility for each child', async () => {
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'secret123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(document.getElementById('gpSiblings')).toBeTruthy());
    expect(document.getElementById('gpElig').textContent).toContain('80');

    const sib2 = document.querySelector('[data-student-id="s2"]');
    sib2.click();
    await vi.waitFor(() => {
      expect(document.getElementById('gpElig').textContent).toContain('90');
      expect(document.getElementById('gpAbsenceForm').getAttribute('data-student')).toBe(
        's2',
      );
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
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'secret123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
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
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'secret123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
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

  async function loginAsParent() {
    document.getElementById('gpPhone').value = '9876543210';
    document.getElementById('gpPassword').value = 'secret123';
    document.getElementById('gpLoginForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(document.getElementById('gpDiary')).toBeTruthy());
  }

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

  it('DoD: no localStorage usage in guardian_portal module sources', () => {
    const dir = path.resolve(__dirname, '../../modules/guardian_portal');
    const files = fs.readdirSync(dir).filter((f) => /\.(js|html|css)$/.test(f));
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src.includes('localStorage')).toBe(false);
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
    }
  });
});
