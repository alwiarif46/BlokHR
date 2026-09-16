import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_timetable module', () => {
  /** @type {typeof import('../../modules/school_timetable/school_timetable.js')} */
  let mod;
  let ttGet;
  let ttPost;
  let ttPut;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';

    ttGet = vi.fn(async (path) => {
      if (path === '/sections') {
        return {
          sections: [
            {
              id: 'sec1',
              classLabel: '8',
              section: 'A',
              daySchemeId: 'ds1',
              academicSessionId: 'ay',
            },
          ],
        };
      }
      if (path === '/subjects') {
        return { subjects: [{ id: 'sub1', code: 'Sc', label: 'Science' }] };
      }
      if (path === '/allocations') {
        return {
          allocations: [
            {
              id: 'al1',
              sectionId: 'sec1',
              subjectId: 'sub1',
              teacherMemberId: 't1',
              periodsPerWeek: 5,
            },
          ],
        };
      }
      if (path === '/day-schemes') {
        return {
          daySchemes: [
            {
              id: 'ds1',
              label: 'Mon-Fri',
              kind: 'weekly',
              periods: [
                { index: 0, label: 'P1', isTeaching: true },
                { index: 1, label: 'P2', isTeaching: true },
              ],
            },
          ],
        };
      }
      if (path === '/terms') return { terms: [] };
      if (path.includes('/slots')) {
        return {
          slots: [{ dayRef: 'mon', periodIndex: 0, allocationId: 'al1' }],
        };
      }
      if (path.startsWith('/cover/fairness')) return { fairness: [] };
      if (path.startsWith('/cover')) {
        return {
          covers: [{ id: 'cov1', state: 'open', coverTeacherMemberId: null }],
        };
      }
      return {};
    });
    ttPost = vi.fn(async (path) => {
      if (path.includes('/offer')) return { id: 'cov1', state: 'offered' };
      return { id: 'new1' };
    });
    ttPut = vi.fn(async () => ({ slots: [] }));
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', () => ({
      api: {
        school: () => ({
          get: ttGet,
          post: ttPost,
          put: ttPut,
          del: vi.fn(async () => ({})),
          patch: vi.fn(async () => ({})),
        }),
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/router.js', () => ({
      registerModule: vi.fn(),
    }));

    mod = await import('../../modules/school_timetable/school_timetable.js');
  });

  afterEach(() => {
    mod._resetState();
    vi.restoreAllMocks();
  });

  it('loads classes tab with sections', async () => {
    const root = document.getElementById('root');
    mod.renderSchoolTimetablePage(root);
    await new Promise((r) => setTimeout(r, 0));
    expect(ttGet).toHaveBeenCalledWith('/sections');
    expect(root.textContent).toContain('sections');
    expect(root.textContent).toContain('8');
  });

  it('switches to grid and loads slots', async () => {
    const root = document.getElementById('root');
    mod.renderSchoolTimetablePage(root);
    await new Promise((r) => setTimeout(r, 0));
    await mod.sttSwitchTab('grid');
    await new Promise((r) => setTimeout(r, 0));
    expect(ttGet.mock.calls.some((c) => String(c[0]).includes('/slots'))).toBe(true);
    expect(root.textContent).toContain('Save grid');
  });

  it('cover offer posts to API', async () => {
    const root = document.getElementById('root');
    mod.renderSchoolTimetablePage(root);
    await new Promise((r) => setTimeout(r, 0));
    await mod.sttSwitchTab('cover');
    await new Promise((r) => setTimeout(r, 0));
    const input = root.querySelector('[data-offer-for="cov1"]');
    input.value = 't2';
    root.querySelector('[data-action="offer-cover"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(ttPost).toHaveBeenCalledWith('/cover/cov1/offer', {
      cover_teacher_member_id: 't2',
    });
  });
});
