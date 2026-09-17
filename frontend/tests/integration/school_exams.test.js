import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_exams (Exams mini-app)', () => {
  /** @type {typeof import('../../modules/school_exams/school_exams.js')} */
  let mod;
  let asGet;
  let asPost;
  let asPut;
  let asPatch;
  let asDel;
  let idGet;
  let toastFn;

  const terms = [
    {
      id: 'term-1',
      academicSessionId: 'ay-2026',
      label: 'PT1',
      startsOn: '2026-04-01',
      endsOn: '2026-04-15',
      weightagePct: 20,
    },
    {
      id: 'term-2',
      academicSessionId: 'ay-2026',
      label: 'HY',
      startsOn: '2026-09-01',
      endsOn: '2026-09-15',
      weightagePct: 30,
    },
  ];

  const exams = [
    {
      id: 'exam-1',
      examTermId: 'term-1',
      courseRef: 'course-sci',
      sectionRef: 'A',
      subjectCode: 'SCI',
      classLabel: '8',
      date: '2026-04-10',
      maxMarks: 80,
      kind: 'summative',
      entryClosesAt: null,
    },
  ];

  const students = [
    { id: 's1', firstName: 'Asha', lastName: 'Rao', section: 'A' },
    { id: 's2', firstName: 'Arun', lastName: 'Rao', section: 'A' },
  ];

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    asGet = vi.fn(async (p) => {
      if (p.startsWith('/exam-terms')) return { terms };
      if (p === '/exams' || p.startsWith('/exams?')) return { exams };
      if (p.startsWith('/exams/') && p.endsWith('/marks')) {
        return {
          marks: [
            {
              id: 'm1',
              studentId: 's1',
              draftMarks: 70,
              assignedMarks: null,
              isAbsent: false,
              isExempt: false,
              publishedAt: null,
            },
          ],
          stats: { mean: 70, median: 70, high: 70, low: 70, absentCount: 0 },
        };
      }
      if (p.startsWith('/exams/') && p.endsWith('/sittings')) {
        return {
          sittings: [
            {
              id: 'sit-1',
              examId: 'exam-1',
              roomLabel: 'Hall A',
              startsOn: '2026-04-10T09:00:00.000Z',
              endsOn: '2026-04-10T11:00:00.000Z',
            },
          ],
        };
      }
      if (p.startsWith('/sittings/') && p.endsWith('/tickets')) {
        return {
          tickets: [
            {
              ticketCode: 'HT-1',
              studentId: 's1',
              roomLabel: 'Hall A',
              seatCode: 'A1',
            },
          ],
        };
      }
      if (p === '/templates') {
        return {
          templates: [
            {
              id: 'tpl-1',
              label: 'Term 1',
              boardFormat: 'cbse_9pt',
              state: 'sandbox',
              version: 1,
            },
          ],
        };
      }
      if (p.startsWith('/report-cards')) return { cards: [] };
      return {};
    });
    asPost = vi.fn(async (p, body) => {
      if (p === '/exam-terms') {
        return { id: 'term-new', ...body, weightagePct: body.weightage_pct };
      }
      if (p === '/exams') {
        return { id: 'exam-new', ...body };
      }
      if (String(p).includes('/marks/import')) {
        return { marks: (body.rows || []).map((r, i) => ({ id: 'imp-' + i, ...r })) };
      }
      if (p.includes('/publish')) {
        if (body && body.force_fail) {
          return {
            _error: true,
            error: 'incomplete marks',
            student_ids: ['s2'],
            status: 400,
          };
        }
        return { marks: [], count: 1 };
      }
      if (String(p).includes('/unlock')) {
        return { id: 'exam-1', entryClosesAt: null };
      }
      if (String(p).includes('/issue-tickets')) {
        return { tickets: [{ ticketCode: 'HT-1', studentId: 's1' }] };
      }
      if (String(p).includes('/sittings') && !String(p).includes('issue')) {
        return {
          sitting: { id: 'sit-new', roomLabel: body.room_label },
          seats: (body.student_ids || []).map((id, i) => ({
            studentId: id,
            seatCode: 'A' + (i + 1),
          })),
        };
      }
      if (p === '/templates') {
        return {
          id: 'tpl-new',
          label: body.label,
          boardFormat: body.board_format,
          state: 'sandbox',
          version: 1,
        };
      }
      if (p.includes('/promote')) {
        return { id: 'tpl-1', state: 'live', version: 2 };
      }
      if (p.includes('/clone')) {
        return { id: 'tpl-clone', state: 'sandbox', version: 1 };
      }
      if (p === '/report-cards/generate') {
        return {
          cards: (body.students || []).map(function (s, i) {
            return {
              id: 'card-' + i,
              studentId: s.student_id,
              academicSessionRef: body.session,
              templateVersion: 1,
              generatedAt: '2026-04-20',
            };
          }),
        };
      }
      return { ok: true };
    });
    asPut = vi.fn(async () => ({
      marks: [{ id: 'm1', studentId: 's1', draftMarks: 72 }],
    }));
    asPatch = vi.fn(async (p, body) => {
      if (String(p).startsWith('/exams/')) {
        return { id: 'exam-1', entryClosesAt: body.entry_closes_at };
      }
      return { ok: true };
    });
    asDel = vi.fn(async () => ({}));
    idGet = vi.fn(async () => ({ items: students }));
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', () => ({
      api: {
        school: (name) => {
          if (name === 'school-assessment') {
            return { get: asGet, post: asPost, put: asPut, patch: asPatch, del: asDel };
          }
          if (name === 'school-identity') {
            return { get: idGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
          }
          throw new Error('unexpected service ' + name);
        },
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({
        email: 'admin@school.test',
        schoolRole: 'school_admin',
        is_admin: false,
        role: 'school_admin',
      }),
    }));
    vi.doMock('../../shared/router.js', () => ({
      registerModule: vi.fn(),
      navigateToModule: vi.fn(),
    }));

    mod = await import('../../modules/school_exams/school_exams.js');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('sumWeightage totals session terms', () => {
    expect(mod.sumWeightage(terms, 'ay-2026')).toBe(50);
    expect(mod.sumWeightage(terms, 'other')).toBe(0);
  });

  it('draftMarkValid enforces range and absent/exempt exclusivity', () => {
    expect(mod.draftMarkValid(70, 80, false, false).ok).toBe(true);
    expect(mod.draftMarkValid(90, 80, false, false).ok).toBe(false);
    expect(mod.draftMarkValid('', 80, true, false).ok).toBe(true);
    expect(mod.draftMarkValid(10, 80, true, false).ok).toBe(false);
    expect(mod.draftMarkValid('', 80, true, true).ok).toBe(false);
  });

  it('marksPayloadFromGrid builds PUT body', () => {
    const payload = mod.marksPayloadFromGrid(
      {
        s1: { draftMarks: '70', isAbsent: false, isExempt: false },
        s2: { draftMarks: '', isAbsent: true, isExempt: false },
        s3: { draftMarks: '', isAbsent: false, isExempt: true },
        s4: { draftMarks: '', isAbsent: false, isExempt: false },
      },
      'teacher@x.com',
    );
    expect(payload.entered_by).toBe('teacher@x.com');
    expect(payload.marks).toEqual([
      { student_id: 's1', draft_marks: 70 },
      { student_id: 's2', is_absent: true },
      { student_id: 's3', is_exempt: true },
    ]);
  });

  it('parseMarksCsv parses header rows and flags', () => {
    const parsed = mod.parseMarksCsv(
      'student_id,draft_marks,is_absent,is_exempt\ns1,70,false,false\ns2,,true,false\ns3,,0,yes\n,10,false,false\n',
    );
    expect(parsed.rows).toEqual([
      { student_id: 's1', draft_marks: 70 },
      { student_id: 's2', is_absent: true },
      { student_id: 's3', is_exempt: true },
    ]);
    expect(parsed.errors.some((e) => /missing student_id/.test(e))).toBe(true);
  });

  it('renders tabs and loads marks for school_admin', async () => {
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    const views = Array.from(root.querySelectorAll('.sex-tab')).map((el) =>
      el.getAttribute('data-view'),
    );
    expect(views.length).toBeGreaterThanOrEqual(4);
    expect(views).toContain('sittings');
    expect(views).toContain('tickets');
    expect(root.querySelector('[data-view="marks"]').classList.contains('active')).toBe(true);
    expect(asGet).toHaveBeenCalledWith('/exams');
    expect(asGet).toHaveBeenCalledWith('/exams/exam-1/marks');
    expect(idGet).toHaveBeenCalled();
    expect(root.querySelector('.sex-draft')).toBeTruthy();
    expect(root.textContent).toContain('Mean:');
  });

  it('term create posts expected payload', async () => {
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    root.querySelector('[data-view="terms"]').click();
    await vi.waitFor(() => expect(root.querySelector('#sexTermCreate')).toBeTruthy());
    const start = root.querySelector('#sexTermStart');
    const end = root.querySelector('#sexTermEnd');
    const weight = root.querySelector('#sexTermWeight');
    start.value = '2026-11-01';
    end.value = '2026-11-10';
    weight.value = '25';
    root.querySelector('#sexTermCreate').click();
    await vi.waitFor(() =>
      expect(asPost).toHaveBeenCalledWith(
        '/exam-terms',
        expect.objectContaining({
          academic_session_id: expect.any(String),
          label: 'PT1',
          starts_on: '2026-11-01',
          ends_on: '2026-11-10',
          weightage_pct: 25,
        }),
      ),
    );
  });

  it('exam create posts planner payload', async () => {
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    root.querySelector('[data-view="planner"]').click();
    await vi.waitFor(() => expect(root.querySelector('#sexExamCreate')).toBeTruthy());
    root.querySelector('#sexExamTerm').value = 'term-1';
    root.querySelector('#sexExamCourse').value = 'course-math';
    root.querySelector('#sexExamSection').value = 'B';
    root.querySelector('#sexExamSubject').value = 'MAT';
    root.querySelector('#sexExamClass').value = '9';
    root.querySelector('#sexExamDate').value = '2026-05-01';
    root.querySelector('#sexExamMax').value = '100';
    root.querySelector('#sexExamKind').value = 'formative';
    root.querySelector('#sexExamCreate').click();
    await vi.waitFor(() =>
      expect(asPost).toHaveBeenCalledWith(
        '/exams',
        expect.objectContaining({
          exam_term_id: 'term-1',
          course_ref: 'course-math',
          section_ref: 'B',
          subject_code: 'MAT',
          class_label: '9',
          date: '2026-05-01',
          max_marks: 100,
          kind: 'formative',
        }),
      ),
    );
  });

  it('save drafts puts marks payload', async () => {
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    const draft = root.querySelector('.sex-draft[data-sid="s1"]');
    draft.value = '72';
    draft.dispatchEvent(new Event('change'));
    root.querySelector('#sexMarksSave').click();
    await vi.waitFor(() =>
      expect(asPut).toHaveBeenCalledWith(
        '/exams/exam-1/marks',
        expect.objectContaining({
          entered_by: 'admin@school.test',
          marks: expect.arrayContaining([
            expect.objectContaining({ student_id: 's1', draft_marks: 72 }),
          ]),
        }),
      ),
    );
  });

  it('import posts to marks/import', async () => {
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    await vi.waitFor(() => expect(root.querySelector('#sexMarksImport')).toBeTruthy());

    const csv =
      'student_id,draft_marks,is_absent,is_exempt\ns1,71,false,false\ns2,,true,false\n';
    const file = new File([csv], 'marks.csv', { type: 'text/csv' });
    const input = root.querySelector('#sexCsvFile');

    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => [file],
    });

    class FakeFileReader {
      constructor() {
        this.result = '';
        this.onload = null;
      }
      readAsText() {
        this.result = csv;
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    root.querySelector('#sexMarksImport').click();
    await vi.waitFor(() =>
      expect(asPost).toHaveBeenCalledWith(
        '/exams/exam-1/marks/import',
        expect.objectContaining({
          entered_by: 'admin@school.test',
          rows: expect.arrayContaining([
            expect.objectContaining({ student_id: 's1', draft_marks: 71 }),
            expect.objectContaining({ student_id: 's2', is_absent: true }),
          ]),
        }),
      ),
    );
  });

  it('publish missing-row error lists student_ids', async () => {
    asPost.mockImplementation(async (p) => {
      if (String(p).includes('/publish')) {
        return {
          _error: true,
          error: 'incomplete marks',
          student_ids: ['s2'],
          status: 400,
        };
      }
      return { ok: true };
    });
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    root.querySelector('#sexMarksPublish').click();
    await vi.waitFor(() => expect(root.querySelector('#sexPublishMissing')).toBeTruthy());
    expect(toastFn).toHaveBeenCalledWith('incomplete marks', 'error');
    expect(root.textContent).toContain('Missing draft for student s2');
  });

  it('generate report cards posts students for class', async () => {
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    root.querySelector('[data-view="report_cards"]').click();
    await vi.waitFor(() => expect(root.querySelector('#sexGenRun')).toBeTruthy());
    root.querySelector('#sexGenTpl').value = 'tpl-1';
    root.querySelector('#sexGenSession').value = 'ay-2026';
    root.querySelector('#sexGenClass').value = '8';
    root.querySelector('#sexGenRun').click();
    await vi.waitFor(() =>
      expect(asPost).toHaveBeenCalledWith(
        '/report-cards/generate',
        expect.objectContaining({
          template_id: 'tpl-1',
          session: 'ay-2026',
          generated_by: 'admin@school.test',
          students: expect.arrayContaining([
            expect.objectContaining({ student_id: 's1' }),
            expect.objectContaining({ student_id: 's2' }),
          ]),
        }),
      ),
    );
  });

  it('hides admin tabs for teacher role', async () => {
    vi.resetModules();
    vi.doMock('../../shared/api.js', () => ({
      api: {
        school: (name) => {
          if (name === 'school-assessment') {
            return { get: asGet, post: asPost, put: asPut, patch: asPatch, del: asDel };
          }
          return { get: idGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
        },
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn, setToastDuration: () => {} }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({
        email: 'teacher@school.test',
        schoolRole: 'teacher',
        is_admin: false,
        role: 'teacher',
      }),
    }));
    vi.doMock('../../shared/router.js', () => ({
      registerModule: vi.fn(),
      navigateToModule: vi.fn(),
    }));
    mod = await import('../../modules/school_exams/school_exams.js');

    expect(mod.sexVisibleTabs()).toEqual(['planner', 'marks', 'tickets']);
    const root = document.getElementById('root');
    await mod.renderSchoolExamsPage(root);
    const views = Array.from(root.querySelectorAll('.sex-tab')).map((el) =>
      el.getAttribute('data-view'),
    );
    expect(views).toEqual(['planner', 'marks', 'tickets']);
    expect(root.querySelector('#sexMarksPublish')).toBeNull();
  });
});
