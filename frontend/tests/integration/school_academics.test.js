import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_academics (F-05)', () => {
  /** @type {typeof import('../../modules/school_academics/school_academics.js')} */
  let mod;
  let acGet;
  let acPost;
  let acPut;
  let ttGet;
  let toastFn;

  const course = {
    id: 'c1',
    label: 'Science 8',
    subjectCode: 'Sc',
    classLabel: '8',
  };

  const tree = {
    id: 'c1',
    label: 'Science 8',
    units: [
      {
        id: 'u1',
        label: 'Unit 1',
        sequence: 1,
        topics: [{ id: 't1', label: 'Cells' }],
        outcomes: [
          { outcomeId: 'o1', field: 'activity', depth: 'introduced' },
        ],
      },
      {
        id: 'u2',
        label: 'Unit 2',
        sequence: 2,
        topics: [{ id: 't2', label: 'Atoms' }],
        outcomes: [],
      },
    ],
  };

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    acGet = vi.fn(async (path) => {
      if (path === '/courses') return { courses: [course] };
      if (path === '/courses/c1/tree') return { ...tree };
      if (path === '/outcomes') {
        return {
          outcomes: [
            { id: 'o1', code: '8.Sc.LO1', description: 'Cell structure' },
            { id: 'o2', code: '8.Sc.LO2', description: 'Atoms' },
          ],
        };
      }
      if (path.includes('/coverage')) {
        return {
          courseId: 'c1',
          sectionRef: 'sec-1',
          units: [
            {
              unitId: 'u1',
              label: 'Unit 1',
              topicsTotal: 2,
              topicsDelivered: 1,
              pct: 50,
              outcomes: [
                {
                  outcomeId: 'o1',
                  coveredActivity: true,
                  coveredAssessment: false,
                },
              ],
            },
          ],
        };
      }
      if (path.startsWith('/lessons')) {
        if (path.includes('state=submitted')) {
          return {
            lessons: [
              {
                id: 'les-sub',
                title: 'Review me',
                state: 'submitted',
                provenance: 'ai_assisted',
                body: {},
              },
            ],
          };
        }
        return {
          lessons: [
            {
              id: 'les-1',
              title: 'My draft',
              state: 'draft',
              provenance: 'human',
              body: {
                objectives: 'a',
                activities: 'b',
                materials: 'c',
                assessment_check: 'd',
              },
            },
          ],
        };
      }
      return {};
    });

    acPost = vi.fn(async (path, body) => {
      if (path.includes('/variance')) {
        return {
          plannedCurve: [
            { week: 1, cumulativeTopics: 1 },
            { week: 2, cumulativeTopics: 2 },
          ],
          actualCurve: [
            { week: 1, cumulativeTopics: 0 },
            { week: 2, cumulativeTopics: 1 },
          ],
          units: [
            {
              unitId: 'u1',
              label: 'Unit 1',
              slippageWeeks: 1,
              lostPeriods: [{ reason: 'holiday', count: 2 }],
            },
          ],
          remainingTopics: 1,
          projectedCompletionDate: '2026-09-01',
          daysPastTarget: 5,
          stalled: false,
        };
      }
      if (path.includes('/outcomes')) {
        if (body.field === 'assessment') {
          return {
            _error: true,
            status: 400,
            message: 'assessment requires activity tag for the same outcome on the unit',
          };
        }
        return { outcomeId: body.outcome_id, field: body.field, depth: body.depth };
      }
      if (path.includes('/review')) {
        if (body.decision === 'changes_requested' && !body.review_note) {
          return {
            _error: true,
            status: 400,
            message: 'review_note is required for changes_requested',
          };
        }
        return { id: path.split('/')[2], state: body.decision };
      }
      return {};
    });

    acPut = vi.fn(async (path, body) => {
      if (path.includes('/reorder')) return { units: body.ordered_ids };
      return {};
    });

    ttGet = vi.fn(async (path) => {
      if (path.includes('/instances')) {
        return {
          instances: [
            {
              id: 'i1',
              date: '2026-01-08',
              status: 'held',
              lostReason: null,
            },
            {
              id: 'i2',
              date: '2026-01-09',
              status: 'lost',
              lostReason: 'holiday',
            },
          ],
        };
      }
      return {};
    });

    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(async () => null, {
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          school: (name) => {
            if (name === 'school-academics') {
              return {
                get: acGet,
                post: acPost,
                put: acPut,
                patch: vi.fn(),
                del: vi.fn(),
              };
            }
            if (name === 'school-timetable') {
              return { get: ttGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
            }
            return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
          },
        }),
      };
    });

    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));

    vi.doMock('../../shared/session.js', async () => {
      const actual = await vi.importActual('../../shared/session.js');
      return {
        ...actual,
        getSession: () => ({
          email: 'teacher@school.test',
          name: 'Teacher',
          schoolRole: 'school_admin',
        }),
      };
    });

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule: vi.fn(),
    }));

    mod = await import('../../modules/school_academics/school_academics.js');
    mod.renderSchoolAcademicsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('.sac-tree-unit')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders curriculum tree with outcome field/depth badges', () => {
    expect(document.body.textContent).toMatch(/Unit 1/);
    expect(document.body.textContent).toMatch(/Cells/);
    expect(document.querySelector('.sac-chip .sac-field').textContent).toBe('A');
    expect(document.querySelector('.sac-chip .sac-depth').textContent).toBe('I');
  });

  it('shows empty units message when course has no units', () => {
    mod.sacSetState({
      courses: [course],
      courseId: 'c1',
      loadError: null,
      tree: { id: 'c1', units: [] },
    });
    expect(document.getElementById('sacEmptyUnits')).toBeTruthy();
    expect(document.getElementById('sacEmptyUnits').textContent).toMatch(/No units/);
  });

  it('reorders units via API', async () => {
    expect(mod.reorderIds(['u1', 'u2'], 'u2', 'u1')).toEqual(['u2', 'u1']);
    const ordered = await mod.sacReorderUnits('u2', 'u1');
    expect(acPut).toHaveBeenCalledWith(
      '/courses/c1/units/reorder',
      expect.objectContaining({ ordered_ids: ['u2', 'u1'] }),
    );
    expect(ordered).toEqual(['u2', 'u1']);
  });

  it('enforces assessment-requires-activity tag rule', () => {
    const err = mod.validateOutcomeTag(
      [{ outcomeId: 'o2', field: 'resource' }],
      'o2',
      'assessment',
    );
    expect(err).toMatch(/assessment requires activity/);
    expect(
      mod.validateOutcomeTag([{ outcomeId: 'o2', field: 'activity' }], 'o2', 'assessment'),
    ).toBeNull();
  });

  it('renders coverage grid cells', async () => {
    mod.sacSetState({
      tab: 'coverage',
      sectionRef: 'sec-1',
      coverage: {
        units: [
          {
            unitId: 'u1',
            label: 'Unit 1',
            topicsTotal: 2,
            topicsDelivered: 1,
            pct: 50,
            outcomes: [
              { outcomeId: 'o1', coveredActivity: true, coveredAssessment: false },
            ],
          },
        ],
      },
    });
    expect(document.getElementById('sacOutcomeGrid')).toBeTruthy();
    expect(document.querySelector('[data-cell="activity"].filled')).toBeTruthy();
    expect(document.querySelector('[data-cell="assessment"].grey')).toBeTruthy();
    const grid = mod.buildOutcomeGrid(mod.sacGetState().coverage);
    expect(grid[0].activity).toBe(true);
    expect(grid[0].assessment).toBe(false);
  });

  it('variance composition calls timetable then academics', async () => {
    const result = await mod.composeVarianceReport('c1', 'sec-1', {
      targetDate: '2026-08-01',
    });
    expect(ttGet).toHaveBeenCalledWith(expect.stringContaining('/sections/sec-1/instances'));
    expect(acPost).toHaveBeenCalledWith(
      '/courses/c1/variance',
      expect.objectContaining({
        section_ref: 'sec-1',
        target_date: '2026-08-01',
        instances: expect.arrayContaining([
          expect.objectContaining({ id: 'i1', status: 'held' }),
        ]),
      }),
    );
    expect(result.report.daysPastTarget).toBe(5);

    mod.sacSetState({ tab: 'variance', variance: result.report, sectionRef: 'sec-1' });
    expect(document.getElementById('sacWeekBars')).toBeTruthy();
    expect(document.getElementById('sacProjDate').classList.contains('sac-past-target')).toBe(
      true,
    );
    expect(document.body.textContent).toMatch(/holiday/);
  });

  it('lesson review requires note for changes_requested', async () => {
    mod.sacSetState({
      tab: 'lessons',
      lessons: [],
      reviewQueue: [
        { id: 'les-sub', title: 'Review me', state: 'submitted', provenance: 'ai_assisted' },
      ],
    });
    expect(document.getElementById('sacProvBadge') || document.querySelector('.sac-provenance')).toBeTruthy();
    expect(document.querySelector('.sac-provenance.ai_assisted')).toBeTruthy();

    const blocked = await mod.sacReviewLesson('les-sub', 'changes_requested', '');
    expect(blocked).toBeNull();
    expect(toastFn).toHaveBeenCalledWith(
      expect.stringMatching(/review_note/),
      'error',
    );
    expect(acPost).not.toHaveBeenCalledWith(
      expect.stringContaining('/review'),
      expect.anything(),
    );

    await mod.sacReviewLesson('les-sub', 'changes_requested', 'Please add materials');
    expect(acPost).toHaveBeenCalledWith(
      '/lessons/les-sub/review',
      expect.objectContaining({
        decision: 'changes_requested',
        review_note: 'Please add materials',
      }),
    );
  });
});

describe('school_academics L6 teacher gates (P12-06)', () => {
  /** @type {typeof import('../../modules/school_academics/school_academics.js')} */
  let mod;
  let acGet;

  const course = {
    id: 'c1',
    label: 'Science 8',
    subjectCode: 'Sc',
    classLabel: '8',
  };
  const tree = {
    id: 'c1',
    units: [
      {
        id: 'u1',
        label: 'Unit 1',
        topics: [{ id: 't1', label: 'Cells' }],
        outcomes: [{ outcomeId: 'o1', field: 'activity', depth: 'introduced' }],
      },
    ],
  };

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    acGet = vi.fn(async (path) => {
      if (path === '/courses') return { courses: [course] };
      if (path === '/courses/c1/tree') return { ...tree };
      if (path === '/outcomes') return { outcomes: [] };
      if (path.startsWith('/lessons')) {
        if (path.includes('state=submitted')) return { lessons: [{ id: 'x', title: 'R' }] };
        return { lessons: [{ id: 'l1', title: 'My draft', state: 'draft', provenance: 'human' }] };
      }
      return {};
    });
    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(async () => null, {
          get: vi.fn(),
          school: (name) => {
            if (name === 'school-academics') {
              return {
                get: acGet,
                post: vi.fn(),
                put: vi.fn(),
                patch: vi.fn(),
                del: vi.fn(),
              };
            }
            return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
          },
        }),
      };
    });
    vi.doMock('../../shared/toast.js', () => ({ toast: vi.fn(), setToastDuration: () => {} }));
    vi.doMock('../../shared/session.js', async () => {
      const actual = await vi.importActual('../../shared/session.js');
      return {
        ...actual,
        getSession: () => ({ email: 'teacher@school.test', schoolRole: 'teacher' }),
      };
    });
    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule: vi.fn(),
    }));
    mod = await import('../../modules/school_academics/school_academics.js');
    mod.renderSchoolAcademicsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('.sac-tree-unit')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides course writes and review queue for teacher', async () => {
    /* L6 cosmetic — enforced server-side by P12-04/05 */
    expect(document.querySelector('[data-tag-unit]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Drag units/);
    mod.sacSwitchTab('lessons');
    await vi.waitFor(() => {
      expect(document.getElementById('sacLessonList')).toBeTruthy();
    });
    expect(document.getElementById('sacReviewList')).toBeNull();
    expect(document.body.textContent).toMatch(/My week/);
    expect(document.body.textContent).not.toMatch(/Reviewer queue/);
  });
});

describe('school_academics homework tab', () => {
  /** @type {typeof import('../../modules/school_academics/school_academics.js')} */
  let mod;
  let acGet;
  let acPost;
  let acPatch;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    toastFn = vi.fn();
    acGet = vi.fn(async (path) => {
      if (path === '/courses') {
        return {
          courses: [{ id: 'c1', label: 'Science 8', subjectCode: 'Sc', classLabel: '8' }],
        };
      }
      if (path === '/courses/c1/tree') {
        return { id: 'c1', label: 'Science 8', units: [], outcomes: [] };
      }
      if (path === '/outcomes') return { outcomes: [] };
      if (path.startsWith('/assignments?')) {
        return {
          assignments: [{ id: 'a1', title: 'Worksheet 1', sectionRef: '8|A' }],
        };
      }
      if (path.includes('/submissions')) {
        return {
          submissions: [{ id: 'sub1', studentId: 's1', state: 'turned_in', draftGrade: null }],
        };
      }
      if (path.includes('/stats')) {
        return { assigned: 1, turned_in: 1, returned: 0 };
      }
      return {};
    });
    acPost = vi.fn(async (path) => {
      if (path === '/assignments') {
        return { assignment: { id: 'a2', title: 'New HW' }, submissions: [] };
      }
      if (path.includes('/return')) return { id: 'sub1', state: 'returned' };
      return {};
    });
    acPatch = vi.fn(async () => ({ id: 'sub1', draftGrade: 8 }));

    vi.doMock('../../shared/api.js', () => ({
      api: {
        school: (name) => {
          if (name === 'school-academics') {
            return {
              get: acGet,
              post: acPost,
              put: vi.fn(),
              patch: acPatch,
              del: vi.fn(),
            };
          }
          return {
            get: vi.fn(async () => ({})),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            del: vi.fn(),
          };
        },
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));
    vi.doMock('../../shared/session.js', async () => {
      const actual = await vi.importActual('../../shared/session.js');
      return {
        ...actual,
        getSession: () => ({
          email: 'teacher@school.test',
          schoolRole: 'teacher',
          name: 'Teacher',
        }),
      };
    });
    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule: vi.fn(),
    }));

    mod = await import('../../modules/school_academics/school_academics.js');
    mod.renderSchoolAcademicsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('.sac-tab')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists assignments and grades a submission', async () => {
    await vi.waitFor(() => {
      expect(acGet.mock.calls.some((c) => c[0] === '/courses')).toBe(true);
    });
    mod.sacSetState({ sectionRef: '8|A', courseId: 'c1' });
    await mod.sacSwitchTab('homework');
    await vi.waitFor(() => {
      expect(document.getElementById('sacHwCreate')).toBeTruthy();
    });
    expect(document.body.textContent).toContain('Worksheet 1');

    const gradeInput = document.querySelector('[data-grade-for="sub1"]');
    gradeInput.value = '8';
    document.querySelector('[data-hw-grade="sub1"]').click();
    await vi.waitFor(() => {
      expect(acPatch).toHaveBeenCalledWith(
        '/submissions/sub1/grade',
        expect.objectContaining({ draft_grade: 8 }),
      );
    });
  });
});

describe('school_academics empty / service states', () => {
  /** @type {typeof import('../../modules/school_academics/school_academics.js')} */
  let mod;
  let acGet;
  let toastFn;
  let navigateToModule;
  let sessionUser;

  async function boot(getImpl) {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    sessionStorage.clear();
    sessionUser = { email: 'teacher@school.test', name: 'Teacher', is_admin: false, role: 'employee' };
    acGet = vi.fn(getImpl);
    toastFn = vi.fn();
    navigateToModule = vi.fn();

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(async () => null, {
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          school: () => ({
            get: acGet,
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            del: vi.fn(),
          }),
        }),
      };
    });
    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));
    vi.doMock('../../shared/session.js', async () => {
      const actual = await vi.importActual('../../shared/session.js');
      return {
        ...actual,
        getSession: () => sessionUser,
      };
    });
    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule,
    }));

    mod = await import('../../modules/school_academics/school_academics.js');
    mod.renderSchoolAcademicsPage(document.getElementById('root'));
  }

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('shows unavailable panel on 502 / courses load error', async () => {
    await boot(async (path) => {
      if (path === '/courses') {
        return {
          _error: true,
          status: 502,
          message: 'upstream_unavailable',
          error: 'upstream_unavailable',
        };
      }
      return {};
    });
    await vi.waitFor(() => {
      expect(document.getElementById('sacUnavailable')).toBeTruthy();
    });
    expect(document.getElementById('sacUnavailable').textContent).toMatch(/unavailable/i);
    expect(document.getElementById('sacRetryBtn')).toBeTruthy();
    expect(toastFn).toHaveBeenCalled();
  });

  it('shows no-syllabus copy for employees without install CTA', async () => {
    await boot(async (path) => {
      if (path === '/courses') return { courses: [] };
      return {};
    });
    await vi.waitFor(() => {
      expect(document.getElementById('sacNoCourses')).toBeTruthy();
    });
    expect(document.getElementById('sacNoCourses').textContent).toMatch(/Ask an admin/);
    expect(document.getElementById('sacInstallSyllabusBtn')).toBeFalsy();
  });

  it('admin no-syllabus CTA opens School Settings syllabus tab', async () => {
    await boot(async (path) => {
      if (path === '/courses') return { courses: [] };
      return {};
    });
    sessionUser = {
      email: 'admin@school.test',
      name: 'Admin',
      is_admin: true,
      role: 'admin',
    };
    mod.sacSetState({ courses: [], loadError: null });
    await vi.waitFor(() => {
      expect(document.getElementById('sacInstallSyllabusBtn')).toBeTruthy();
    });
    document.getElementById('sacInstallSyllabusBtn').click();
    expect(sessionStorage.getItem('scs_open_tab')).toBe('syllabus');
    expect(navigateToModule).toHaveBeenCalledWith('school_settings');
  });
});
