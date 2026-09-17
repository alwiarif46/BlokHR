import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { acceptConfirm } from '../helpers/dialog.js';

describe('school_settings (F-07)', () => {
  /** @type {typeof import('../../modules/school_settings/school_settings.js')} */
  let mod;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolPut;
  /** @type {ReturnType<typeof vi.fn>} */
  let attGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let attPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let attPut;
  /** @type {ReturnType<typeof vi.fn>} */
  let toastFn;
  /** @type {ReturnType<typeof vi.fn>} */
  let navigateToModule;

  const sessionCurrent = {
    id: 'sess-1',
    label: '2025-26',
    startsOn: '2025-04-01',
    endsOn: '2026-03-31',
    isCurrent: true,
  };

  const packMh = {
    code: 'MH',
    label: 'Maharashtra',
    categories: [{ code: 'GEN', label: 'General' }],
    studentIdField: { label: 'SARAL ID', pattern: '^[0-9]{10}$' },
    gradeSchemes: [{ board: 'SSC', labels: ['1', '2', '3'] }],
    scripts: [],
  };

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    sessionStorage.clear();

    schoolGet = vi.fn(async (path) => {
      if (path === '/sessions') return { sessions: [sessionCurrent] };
      if (path === '/state-pack') return { packCode: 'MH', pack: packMh };
      if (path === '/state-packs') {
        return {
          packs: [
            { code: 'MH', label: 'Maharashtra' },
            { code: 'TN', label: 'Tamil Nadu' },
          ],
        };
      }
      if (path === '/state-packs/MH') return { ...packMh };
      if (path === '/state-packs/TN') {
        return {
          code: 'TN',
          label: 'Tamil Nadu',
          categories: [{ code: 'BC', label: 'BC' }],
          gradeSchemes: [],
          scripts: [],
        };
      }
      if (path.startsWith('/students?')) {
        return {
          items: [
            { id: 's1', firstName: 'Asha', lastName: 'Rao', classLabel: '8' },
            { id: 's2', firstName: 'Arun', lastName: 'Rao', classLabel: '8' },
            { id: 's3', firstName: 'Isha', lastName: 'Nair', classLabel: '9' },
          ],
          total: 42,
        };
      }
      if (path === '/day-schemes') return { daySchemes: [] };
      if (path === '/sections') return { sections: [] };
      if (path === '/consents/summary') {
        return {
          summary: {
            apaar: { granted: 2, refused: 1, not_sought: 3, withdrawn: 0 },
            dpdp_processing: { granted: 5, refused: 1, not_sought: 4, withdrawn: 0 },
            biometric: { granted: 0, refused: 0, not_sought: 10, withdrawn: 0 },
            photo: { granted: 8, refused: 0, not_sought: 2, withdrawn: 0 },
            transport_gps: { granted: 0, refused: 0, not_sought: 0, withdrawn: 1 },
          },
        };
      }
      if (path === '/packs') {
        return {
          packs: [
            {
              id: 'cbse-2026-27',
              family: 'cbse',
              academic_year: '2026-27',
              label: 'CBSE sample',
              status: 'sample',
              course_count: 2,
              classes: ['8', '9'],
              subjects: ['Science', 'Mathematics'],
            },
          ],
        };
      }
      if (path === '/packs/cbse-2026-27') {
        return {
          id: 'cbse-2026-27',
          label: 'CBSE sample',
          status: 'sample',
          courses: [
            { subject_code: 'Science', class_label: '8', label: 'Science 8', units: [] },
            { subject_code: 'Mathematics', class_label: '9', label: 'Math 9', units: [] },
          ],
        };
      }
      if (path === '/packs/cbse-2027-28') {
        return {
          id: 'cbse-2027-28',
          label: 'CBSE 2027-28',
          status: 'sample',
          courses: [
            { subject_code: 'Science', class_label: '8', label: 'Science 8', units: [] },
          ],
        };
      }
      if (path === '/packs/installed') {
        return {
          installed: [
            {
              id: 'inst-1',
              pack_id: 'cbse-2026-27',
              academic_session_id: 'sess-1',
              course_count: 2,
              course_ids: ['c1', 'c2'],
              update_available: 'cbse-2027-28',
            },
          ],
        };
      }
      return {};
    });

    schoolPost = vi.fn(async (path) => {
      if (path === '/sessions') {
        return {
          id: 'sess-2',
          label: '2026-27',
          startsOn: '2026-04-01',
          endsOn: '2027-03-31',
          isCurrent: false,
        };
      }
      if (path === '/students/import') {
        return {
          success: true,
          created: 2,
          enrolled: 2,
          skipped: 1,
          errors: [],
          sessionId: 'sess-1',
        };
      }
      if (path === '/import') {
        return {
          success: true,
          daySchemesCreated: 1,
          sectionsCreated: 2,
          sectionsSkipped: 0,
          errors: [],
        };
      }
      if (String(path).includes('/packs/') && String(path).endsWith('/install')) {
        return {
          courses_created: 1,
          courses_skipped: [
            {
              class_label: '9',
              subject_code: 'Mathematics',
              existing_course_id: 'c-existing',
            },
          ],
          installed_pack_id: 'inst-new',
        };
      }
      return {};
    });

    schoolPut = vi.fn(async () => ({ packCode: 'TN', pack: { code: 'TN' } }));

    attGet = vi.fn(async (path) => {
      if (path === '/settings') {
        return {
          granularity: 'day',
          editWindowMinutes: 120,
          lateThresholdMinutes: 15,
          halfDayMinMinutes: 180,
          dayDerivation: 'majority',
        };
      }
      if (path.includes('/eligibility')) {
        return {
          pct: 82,
          threshold: 75,
          eligible: true,
          projected_pct_if_no_more_absences: 84,
        };
      }
      if (path === '/nudge/config') {
        return {
          enabled: true,
          atRiskPct: 10,
          chronicDays: 18,
          holdoutPct: 10,
          maxMessagesPerTerm: 6,
        };
      }
      if (path === '/nudge/report') {
        return {
          treatment: { mean_absence_pct: 8.5, message_count: 12, student_count: 40 },
          holdout: { mean_absence_pct: 11.2, message_count: 0, student_count: 5 },
        };
      }
      return {};
    });

    attPut = vi.fn(async (path, body) => {
      if (path === '/settings') {
        return {
          settings: {
            granularity: body.granularity,
            editWindowMinutes: body.edit_window_minutes,
            lateThresholdMinutes: body.late_threshold_minutes,
            halfDayMinMinutes: body.half_day_min_minutes,
            dayDerivation: body.day_derivation,
          },
        };
      }
      if (path === '/nudge/config') return { config: body };
      return {};
    });

    attPost = vi.fn(async (path) => {
      if (path === '/nudge/run') return { sent: 3, skipped: 1 };
      return {};
    });

    toastFn = vi.fn();
    navigateToModule = vi.fn();

    let apiGet = vi.fn(async (path) => {
      if (path === '/api/directory/members') {
        return { members: [{ id: 't1', name: 'Priya', email: 'p@s.test', role: 'teacher' }] };
      }
      return {};
    });
    let apiPost = vi.fn(async (path) => {
      if (path === '/api/directory/members/import') {
        return { success: true, created: 1, skipped: 0, errors: [] };
      }
      return {};
    });

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(
          async () => null,
          {
            get: apiGet,
            post: apiPost,
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            school: (name) => {
              if (name === 'school-attendance') {
                return {
                  get: attGet,
                  post: attPost,
                  put: attPut,
                  patch: vi.fn(),
                  del: vi.fn(),
                };
              }
              return {
                get: schoolGet,
                post: schoolPost,
                put: schoolPut,
                patch: vi.fn(),
                del: vi.fn(),
              };
            },
          },
        ),
      };
    });

    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));

    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'admin@school.test', name: 'Admin' }),
    }));

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule,
    }));

    mod = await import('../../modules/school_settings/school_settings.js');
    mod._resetState();
    mod.renderSchoolSettingsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('#scsStatSessions')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    sessionStorage.clear();
  });

  it('renders stats bar values', () => {
    expect(document.getElementById('scsStatSessions').textContent).toBe('1');
    expect(document.getElementById('scsStatPack').textContent).toBe('MH');
    expect(document.getElementById('scsStatStudents').textContent).toBe('42');
    expect(document.getElementById('scsStatDpdp').textContent).toBe('50%');
  });

  it('switches tabs', async () => {
    expect(document.getElementById('scsDrop')).toBeTruthy();
    document.querySelector('[data-tab="sessions"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSessionNote')).toBeTruthy();
    });
    expect(document.body.textContent).toMatch(/Marking a session current/);

    document.querySelector('[data-tab="consent"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsConsentTable')).toBeTruthy();
    });
  });

  it('downloads CSV template', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:template'),
      revokeObjectURL: vi.fn(),
    });
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    await mod.scsDownloadTemplate();
    expect(clickSpy).toHaveBeenCalled();
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/template downloaded/i), 'success');
  });

  it('import happy path renders counts', async () => {
    class MockFileReader {
      constructor() {
        this.result = '';
        this.onload = null;
        this.onerror = null;
      }
      readAsDataURL() {
        this.result = 'data:application/octet-stream;base64,QUJD';
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await mod.scsImportFile({ name: 'roster.xlsx' });

    await vi.waitFor(() => {
      expect(document.getElementById('scsImpCreated')).toBeTruthy();
    });
    expect(document.getElementById('scsImpCreated').textContent).toBe('2');
    expect(document.getElementById('scsImpEnrolled').textContent).toBe('2');
    expect(document.getElementById('scsImpSkipped').textContent).toBe('1');
    expect(document.getElementById('scsImpTeachers').textContent).toBe('1');
    expect(document.getElementById('scsImpSchemes').textContent).toBe('1');
    expect(document.getElementById('scsImpClasses').textContent).toBe('2');
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/2 students/), 'success');
  });

  it('import with errors[] renders error table rows', async () => {
    schoolPost.mockImplementation(async (path) => {
      if (path === '/students/import') {
        return {
          success: true,
          created: 0,
          enrolled: 0,
          skipped: 0,
          errors: [{ row: 3, message: 'Invalid gender' }],
          sessionId: 'sess-1',
        };
      }
      if (path === '/import') {
        return {
          success: true,
          daySchemesCreated: 0,
          sectionsCreated: 0,
          sectionsSkipped: 0,
          errors: [{ row: 2, sheet: 'Periods', message: 'bad time' }],
        };
      }
      return {};
    });

    class MockFileReader {
      constructor() {
        this.result = '';
        this.onload = null;
      }
      readAsDataURL() {
        this.result = 'data:;base64,QQ==';
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await mod.scsImportFile({ name: 'bad.csv' });

    await vi.waitFor(() => {
      expect(document.getElementById('scsImportErrors')).toBeTruthy();
    });
    const text = document.getElementById('scsImportErrors').textContent;
    expect(text).toMatch(/Invalid gender/);
    expect(text).toMatch(/bad time/);
    expect(text).toMatch(/Periods/);
  });

  it('session create validation and is_current note', async () => {
    document.querySelector('[data-tab="sessions"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSessSave')).toBeTruthy();
    });
    expect(document.getElementById('scsSessionHelp').textContent).toMatch(
      /unmarks the previous session/i,
    );

    expect(
      mod.validateSessionFields({
        label: '',
        starts_on: '2026-04-01',
        ends_on: '2027-03-31',
      }),
    ).toMatch(/label/);

    expect(
      mod.validateSessionFields({
        label: '2026-27',
        starts_on: 'bad',
        ends_on: '2027-03-31',
      }),
    ).toMatch(/starts_on/);

    document.getElementById('scsSessSave').click();
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/label/i), 'error');
    expect(schoolPost).not.toHaveBeenCalledWith('/sessions', expect.anything());
  });

  it('state-pack change confirm flow', async () => {
    document.querySelector('[data-tab="state_pack"]').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-set-pack="TN"]')).toBeTruthy();
    });

    document.querySelector('[data-set-pack="TN"]').click();
    await acceptConfirm();

    await vi.waitFor(() => {
      expect(schoolPut).toHaveBeenCalledWith(
        '/state-pack',
        expect.objectContaining({ pack_code: 'TN' }),
      );
    });
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/TN/), 'success');
  });

  it('consent table rendering and link to students', async () => {
    document.querySelector('[data-tab="consent"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsConsentTable')).toBeTruthy();
    });
    expect(document.getElementById('scsConsentNote').textContent).toMatch(
      /Refusal does not block/,
    );
    expect(document.querySelector('[data-consent-kind="apaar"]')).toBeTruthy();
    expect(document.querySelector('[data-consent-kind="dpdp_processing"]')).toBeTruthy();

    document.querySelector('[data-go-students]').click();
    expect(navigateToModule).toHaveBeenCalledWith('school_students');
  });

  it('syllabus tab renders registry with SAMPLE badge and IB note', async () => {
    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylRegistry')).toBeTruthy();
    });
    expect(document.body.textContent).toMatch(/SAMPLE/);
    expect(document.querySelector('[title*="Placeholder structure"]')).toBeTruthy();
    expect(document.getElementById('scsSylIbNote').textContent).toMatch(/IB and Cambridge/);
    expect(document.getElementById('scsSylInstalled').textContent).toMatch(/Update available/);
  });

  it('syllabus install dialog subset selection + result with skipped rows', async () => {
    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-install-pack="cbse-2026-27"]')).toBeTruthy();
    });

    document.querySelector('[data-install-pack="cbse-2026-27"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylConfirm')).toBeTruthy();
    });

    expect(document.getElementById('scsSylSession').value).toBe('sess-1');
    expect(document.querySelectorAll('input[name="syl_class"]').length).toBeGreaterThan(0);

    // Uncheck Mathematics subject — subset selection
    document.querySelectorAll('input[name="syl_subject"]').forEach((el) => {
      if (el.value === 'Mathematics') el.checked = false;
    });

    document.getElementById('scsSylConfirm').click();

    await vi.waitFor(() => {
      expect(schoolPost).toHaveBeenCalledWith(
        '/packs/cbse-2026-27/install',
        expect.objectContaining({
          academic_session_id: 'sess-1',
          installed_by: 'admin@school.test',
        }),
      );
    });

    await vi.waitFor(() => {
      expect(document.getElementById('scsSylCreated')).toBeTruthy();
    });
    expect(document.getElementById('scsSylCreated').textContent).toBe('1');
    expect(document.getElementById('scsSylSkipTable').textContent).toMatch(/already exists/);

    document.querySelector('[data-go-academics]').click();
    expect(navigateToModule).toHaveBeenCalledWith('school_academics');
  });

  it('syllabus install error panel path', async () => {
    schoolPost.mockImplementation(async (path) => {
      if (String(path).includes('/install')) {
        return {
          _error: true,
          status: 400,
          message: 'selection_empty',
          error: 'selection_empty',
          errors: [],
        };
      }
      return {};
    });

    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-install-pack]')).toBeTruthy();
    });
    document.querySelector('[data-install-pack]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylConfirm')).toBeTruthy();
    });
    document.getElementById('scsSylConfirm').click();

    await vi.waitFor(() => {
      expect(document.getElementById('scsSylResultPanel')).toBeTruthy();
    });
    expect(document.getElementById('scsSylResultPanel').textContent).toMatch(/selection_empty/);
  });

  it('syllabus update chip opens install for newer pack', async () => {
    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-update-pack="cbse-2027-28"]')).toBeTruthy();
    });
    document.querySelector('[data-update-pack="cbse-2027-28"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylConfirm')).toBeTruthy();
    });
    expect(document.querySelector('.scs-modal-title').textContent).toMatch(/2027-28|CBSE/);
  });

  it('shows upload section with template and lesson-plan checkbox', async () => {
    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylUploadSection')).toBeTruthy();
    });
    expect(document.getElementById('scsSylTemplateBtn')).toBeTruthy();
    expect(document.getElementById('scsSylImportLessons')).toBeTruthy();
    expect(document.getElementById('scsSylLessonHint').textContent).toMatch(/optional/i);
    expect(document.getElementById('scsSylDrop')).toBeTruthy();
  });

  it('toggles selected-classes checkboxes', async () => {
    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylClassChecks')).toBeTruthy();
    });
    expect(document.getElementById('scsSylClassChecks').hidden).toBe(true);
    document.getElementById('scsSylScopeSelected').click();
    expect(document.getElementById('scsSylClassChecks').hidden).toBe(false);
    document.getElementById('scsSylScopeAll').click();
    expect(document.getElementById('scsSylClassChecks').hidden).toBe(true);
  });

  it('custom syllabus upload happy path shows course and lesson counts', async () => {
    schoolPost.mockImplementation(async (path) => {
      if (path === '/syllabus/upload') {
        return {
          courses_created: 2,
          courses_skipped: [
            { class_label: '8', subject_code: 'Science', existing_course_id: 'c1' },
          ],
          lessons_created: 1,
          lessons_skipped: 0,
          lesson_warnings: [],
          classes_in_file: ['8', '9'],
        };
      }
      if (String(path).includes('/packs/') && String(path).endsWith('/install')) {
        return { courses_created: 0, courses_skipped: [], installed_pack_id: 'x' };
      }
      return {};
    });

    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsSylUploadSession')).toBeTruthy();
    });

    class MockFileReader {
      constructor() {
        this.result = '';
        this.onload = null;
      }
      readAsDataURL() {
        this.result = 'data:;base64,QUJD';
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await mod.scsUploadSyllabus({ name: 'own.xlsx' });

    await vi.waitFor(() => {
      expect(document.getElementById('scsSylUpCreated')).toBeTruthy();
    });
    expect(document.getElementById('scsSylUpCreated').textContent).toBe('2');
    expect(document.getElementById('scsSylUpLessons').textContent).toBe('1');
    expect(schoolPost).toHaveBeenCalledWith(
      '/syllabus/upload',
      expect.objectContaining({
        academic_session_id: 'sess-1',
        board: 'cbse',
        import_lesson_plans: true,
      }),
    );
  });

  it('custom upload soft lesson warnings render without hard failure', async () => {
    schoolPost.mockImplementation(async (path) => {
      if (path === '/syllabus/upload') {
        return {
          courses_created: 1,
          courses_skipped: [],
          lessons_created: 0,
          lessons_skipped: 2,
          lesson_warnings: [
            { row: 3, message: 'date required to schedule lesson — skipped' },
            { row: 4, message: 'class and subject required — skipped' },
          ],
        };
      }
      return {};
    });

    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => expect(document.getElementById('scsSylDrop')).toBeTruthy());

    class MockFileReader {
      constructor() {
        this.result = '';
        this.onload = null;
      }
      readAsDataURL() {
        this.result = 'data:;base64,QQ==';
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await mod.scsUploadSyllabus({ name: 'own.csv' });

    await vi.waitFor(() => {
      expect(document.getElementById('scsSylLessonWarnTable')).toBeTruthy();
    });
    expect(document.getElementById('scsSylUploadResultPanel').textContent).toMatch(
      /date required/,
    );
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/Syllabus/), 'success');
  });

  it('custom upload selection_empty shows error panel', async () => {
    schoolPost.mockImplementation(async (path) => {
      if (path === '/syllabus/upload') {
        return {
          _error: true,
          status: 400,
          message: 'selection_empty',
          error: 'selection_empty',
          errors: [],
        };
      }
      return {};
    });

    document.querySelector('[data-tab="syllabus"]').click();
    await vi.waitFor(() => expect(document.getElementById('scsSylDrop')).toBeTruthy());

    class MockFileReader {
      constructor() {
        this.result = '';
        this.onload = null;
      }
      readAsDataURL() {
        this.result = 'data:;base64,QQ==';
        if (this.onload) this.onload();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await mod.scsUploadSyllabus({ name: 'own.xlsx' });

    await vi.waitFor(() => {
      expect(document.getElementById('scsSylUploadResultPanel')).toBeTruthy();
    });
    expect(document.getElementById('scsSylUploadResultPanel').textContent).toMatch(
      /selection_empty/,
    );
  });

  it('renders Attendance Policy, Eligibility, and Nudge tabs', async () => {
    document.querySelector('[data-tab="attendance_policy"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsAttSettingsForm')).toBeTruthy();
    });
    expect(document.getElementById('scsGranularity').selectedOptions[0].textContent).toMatch(
      /Day/,
    );
    expect(document.getElementById('scsDerHelp').textContent.length).toBeGreaterThan(10);

    document.querySelector('[data-tab="eligibility"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsElEmpty')).toBeTruthy();
    });
    expect(document.getElementById('scsElTable')).toBeFalsy();
    expect(attGet).not.toHaveBeenCalledWith(expect.stringContaining('/eligibility'));

    document.querySelector('[data-tab="nudge"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsNudgeReport')).toBeTruthy();
    });
    expect(document.getElementById('scsTreatMean').textContent).toMatch(/8\.5/);
    expect(document.getElementById('scsHoldMean').textContent).toMatch(/11\.2/);
    expect(document.getElementById('scsTreatMsg').textContent).toBe('12');
    expect(document.getElementById('scsHoldMsg').textContent).toBe('0');
    expect(document.body.textContent).toMatch(/Share of eligible students/);
  });

  it('settings validation blocks bad late threshold and save PUTs when valid', async () => {
    expect(
      mod.validateSettingsFields({
        granularity: 'day',
        day_derivation: 'majority',
        edit_window_minutes: 60,
        late_threshold_minutes: 2,
        half_day_min_minutes: 180,
      }),
    ).toMatch(/late_threshold/);

    document.querySelector('[data-tab="attendance_policy"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsLateThr')).toBeTruthy();
    });
    document.getElementById('scsLateThr').value = '2';
    await mod.scsSaveAttendanceSettings();
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/late_threshold/), 'error');
    expect(attPut).not.toHaveBeenCalled();

    document.getElementById('scsLateThr').value = '15';
    await mod.scsSaveAttendanceSettings();
    expect(attPut).toHaveBeenCalledWith(
      '/settings',
      expect.objectContaining({ late_threshold_minutes: 15, granularity: 'day' }),
    );
    expect(toastFn).toHaveBeenCalledWith('Settings saved', 'success');
  });

  it('eligibility run populates named rows without auto-fetch on tab open', async () => {
    document.querySelector('[data-tab="eligibility"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsElLoad')).toBeTruthy();
    });
    const eligCallsBefore = attGet.mock.calls.filter((c) =>
      String(c[0]).includes('/eligibility'),
    ).length;
    expect(eligCallsBefore).toBe(0);

    document.getElementById('scsElClass').value = '8';
    document.getElementById('scsElLoad').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsElTable')).toBeTruthy();
    });
    const row = document.querySelector('#scsElTable tbody tr');
    expect(row.textContent).toMatch(/Asha/);
    expect(row.textContent).toMatch(/82%/);
    expect(row.textContent).toMatch(/84%/);
    expect(row.textContent).toMatch(/yes/);
    expect(schoolGet).toHaveBeenCalledWith(expect.stringMatching(/class=8/));
  });

  it('nudge confirm + run refreshes report numbers', async () => {
    document.querySelector('[data-tab="nudge"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('scsNudgeRun')).toBeTruthy();
    });
    document.getElementById('scsNudgeRun').click();
    await acceptConfirm();
    await vi.waitFor(() => {
      expect(attPost).toHaveBeenCalledWith(
        '/nudge/run',
        expect.objectContaining({ class_map: expect.any(Object) }),
      );
    });
    expect(toastFn).toHaveBeenCalledWith(expect.stringMatching(/sent 3/), 'success');
    expect(document.getElementById('scsTreatMean').textContent).toBe('8.5%');
    expect(document.getElementById('scsHoldN').textContent).toBe('5');
  });
});

describe('school_settings scs_open_tab handoff', () => {
  it('opens Attendance Policy when scs_open_tab is set', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    sessionStorage.setItem('scs_open_tab', 'attendance_policy');

    const schoolGet = vi.fn(async (path) => {
      if (path === '/sessions') return { sessions: [] };
      if (path === '/state-pack') return { packCode: null, pack: null };
      if (path === '/state-packs') return { packs: [] };
      if (path.startsWith('/students?')) return { items: [], total: 0 };
      if (path === '/consents/summary') return { summary: {} };
      if (path === '/packs') return { packs: [] };
      if (path === '/packs/installed') return { installed: [] };
      return {};
    });
    const attGet = vi.fn(async (path) => {
      if (path === '/settings') {
        return {
          granularity: 'session',
          editWindowMinutes: 60,
          lateThresholdMinutes: 10,
          halfDayMinMinutes: 180,
          dayDerivation: 'any_absent',
        };
      }
      return {};
    });

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
            if (name === 'school-attendance') {
              return { get: attGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
            }
            return {
              get: schoolGet,
              post: vi.fn(),
              put: vi.fn(),
              patch: vi.fn(),
              del: vi.fn(),
            };
          },
        }),
      };
    });
    vi.doMock('../../shared/toast.js', () => ({ toast: vi.fn(), setToastDuration: () => {} }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'a@b.test' }),
    }));
    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule: vi.fn(),
    }));

    const mod = await import('../../modules/school_settings/school_settings.js');
    mod._resetState();
    mod.renderSchoolSettingsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.getElementById('scsAttSettingsForm')).toBeTruthy();
    });
    expect(sessionStorage.getItem('scs_open_tab')).toBeNull();
    expect(document.querySelector('.scs-tab.active').dataset.tab).toBe('attendance_policy');
    expect(document.getElementById('scsGranularity').value).toBe('session');
  });
});
