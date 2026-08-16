import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_hpc (F-06)', () => {
  /** @type {typeof import('../../modules/school_hpc/school_hpc.js')} */
  let mod;
  let asGet;
  let asPost;
  let idGet;
  let toastFn;

  const competencies = [
    {
      id: 'mid-1',
      stage: 'middle',
      ability: 'awareness',
      label: 'Middle awareness 1',
    },
    {
      id: 'found-1',
      stage: 'foundational',
      ability: 'creativity',
      label: 'Foundational creativity 1',
    },
    {
      id: 'sec-1',
      stage: 'secondary',
      ability: 'sensitivity',
      label: 'Secondary sensitivity 1',
    },
  ];

  const students = [
    { id: 's1', firstName: 'Asha', lastName: 'Rao' },
    { id: 's2', firstName: 'Arun', lastName: 'Rao' },
  ];

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    asGet = vi.fn(async (path) => {
      if (path.startsWith('/hpc/competencies')) return { competencies };
      if (path.startsWith('/hpc/students/') && path.includes('/matrix')) {
        return { cells: [] };
      }
      if (path.startsWith('/hpc/students/')) {
        return {
          competencies: [
            {
              competencyId: 'mid-1',
              label: 'Middle awareness 1',
              stage: 'middle',
              ability: 'awareness',
              voices: {
                self: 'beginner',
                peer: 'proficient',
                teacher: 'advanced',
                parent: null,
              },
              inputCount: 3,
              evidenceRef: 'ev-123',
            },
          ],
        };
      }
      if (path.startsWith('/hpc/coverage')) {
        return {
          coverage: [
            {
              competencyId: 'mid-1',
              label: 'Middle awareness 1',
              stage: 'middle',
              studentCount: 2,
              filledCount: 1,
              pct: 50,
            },
          ],
        };
      }
      return {};
    });

    asPost = vi.fn(async (path, body) => {
      if (path === '/hpc/inputs/bulk') {
        if ((body.inputs || []).length > 200) {
          return { _error: true, status: 400, message: 'bulk limit is 200 inputs per call' };
        }
        return { inputs: body.inputs };
      }
      if (path === '/hpc/inputs') {
        return {
          id: 'inp-1',
          level: body.level || 'beginner',
          statementsCircled: body.statements_circled,
        };
      }
      return {};
    });

    idGet = vi.fn(async () => ({ items: students, total: 2 }));
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
            if (name === 'school-assessment') {
              return { get: asGet, post: asPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() };
            }
            if (name === 'school-identity') {
              return { get: idGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
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
        getSession: () => ({ email: 'teacher@school.test', name: 'Teacher' }),
      };
    });

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
    }));

    mod = await import('../../modules/school_hpc/school_hpc.js');
    mod.renderSchoolHpcPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.getElementById('hpcSourceLock')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mirrors derived-level boundaries (0–2 B, 3–4 P, 5–6 A)', () => {
    expect(mod.deriveLevelFromCircled(0)).toBe('beginner');
    expect(mod.deriveLevelFromCircled(2)).toBe('beginner');
    expect(mod.deriveLevelFromCircled(3)).toBe('proficient');
    expect(mod.deriveLevelFromCircled(4)).toBe('proficient');
    expect(mod.deriveLevelFromCircled(5)).toBe('advanced');
    expect(mod.deriveLevelFromCircled(6)).toBe('advanced');
    expect(mod.deriveLevelFromCircled(7)).toBeNull();
    expect(mod.deriveLevelFromCircled(-1)).toBeNull();
  });

  it('renders middle checklist and live derived chip', async () => {
    await vi.waitFor(() => {
      expect(document.querySelector('[data-checklist="mid-1"]')).toBeTruthy();
    });
    expect(document.getElementById('hpcSourceLock').textContent).toMatch(/teacher/);
    const boxes = document.querySelectorAll('[data-stmt="mid-1"]');
    expect(boxes.length).toBe(18);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event('change'));
    boxes[1].checked = true;
    boxes[1].dispatchEvent(new Event('change'));
    boxes[2].checked = true;
    boxes[2].dispatchEvent(new Event('change'));
    expect(document.querySelector('[data-derived="mid-1"]').textContent).toMatch(/P \(3\)/);
  });

  it('peer batch cap chunks at 200', () => {
    const inputs = Array.from({ length: 450 }, (_, i) => ({ id: i }));
    const chunks = mod.chunkPeerBatch(inputs, 200);
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(200);
    expect(chunks[1].length).toBe(200);
    expect(chunks[2].length).toBe(50);
  });

  it('flushes peer buffer via bulk endpoint', async () => {
    mod.hpcSetState({
      view: 'peer',
      students,
      competencies,
      peerCompetencyId: 'found-1',
      peerIndex: 0,
      peerSlot: 0,
      peerBuffer: [],
    });
    mod.hpcPeerMark('beginner');
    mod.hpcPeerMark('proficient');
    expect(mod.hpcGetState().peerBuffer.length).toBe(2);
    await mod.hpcFlushPeerBuffer();
    expect(asPost).toHaveBeenCalledWith(
      '/hpc/inputs/bulk',
      expect.objectContaining({
        inputs: expect.arrayContaining([
          expect.objectContaining({ source: 'peer', level: 'beginner' }),
        ]),
      }),
    );
    expect(mod.hpcGetState().peerBuffer.length).toBe(0);
  });

  it('renders four-voice grouping with evidence refs', async () => {
    mod.hpcSetState({
      view: 'four_voice',
      studentId: 's1',
      students,
      fourVoice: mod.groupFourVoice([
        {
          competencyId: 'mid-1',
          label: 'Middle awareness 1',
          stage: 'middle',
          ability: 'awareness',
          voices: {
            self: 'beginner',
            peer: 'proficient',
            teacher: 'advanced',
            parent: null,
          },
          inputCount: 3,
          evidenceRef: 'ev-123',
        },
      ]),
    });
    expect(document.getElementById('hpcFvTable')).toBeTruthy();
    const row = document.querySelector('[data-fv-comp="mid-1"]');
    expect(row.textContent).toMatch(/B/);
    expect(row.textContent).toMatch(/P/);
    expect(row.textContent).toMatch(/A/);
    expect(row.textContent).toMatch(/3/);
    expect(row.textContent).toMatch(/ev-123/);
  });

  it('coverage percentages and matrix cells', async () => {
    mod.hpcSetState({
      view: 'coverage',
      students,
      coverage: [
        {
          competencyId: 'mid-1',
          label: 'Middle awareness 1',
          pct: 50,
          filledCount: 1,
          studentCount: 2,
        },
      ],
      matrixCounts: {
        'mid-1': { B: 1, P: 0, A: 2, label: 'Middle awareness 1' },
      },
    });
    expect(document.querySelector('[data-cov="mid-1"]').textContent).toMatch(/50%/);
    expect(document.getElementById('hpcGradeMatrix')).toBeTruthy();
    expect(document.querySelector('[data-grade="B"]').textContent).toBe('1');
    expect(document.querySelector('[data-grade="A"]').classList.contains('filled')).toBe(true);

    const built = mod.buildGradeMatrix([
      {
        competencies: [
          {
            competencyId: 'mid-1',
            label: 'Middle awareness 1',
            voices: { teacher: 'advanced' },
          },
        ],
      },
      {
        competencies: [
          {
            competencyId: 'mid-1',
            label: 'Middle awareness 1',
            voices: { teacher: 'beginner' },
          },
        ],
      },
    ]);
    expect(built['mid-1'].A).toBe(1);
    expect(built['mid-1'].B).toBe(1);
  });
});
