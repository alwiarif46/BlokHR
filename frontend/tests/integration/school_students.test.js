import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_students (F-02)', () => {
  /** @type {typeof import('../../modules/school_students/school_students.js')} */
  let mod;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolPatch;
  /** @type {ReturnType<typeof vi.fn>} */
  let schoolDel;
  /** @type {ReturnType<typeof vi.fn>} */
  let toastFn;

  const sampleStudent = {
    id: 'stu-1',
    admissionNumber: 'A-100',
    firstName: 'Asha',
    lastName: 'Rao',
    dob: '2015-06-01',
    gender: 'female',
    admissionDate: '2022-04-01',
    status: 'active',
    category: 'GEN',
    motherName: 'Meera',
    fatherName: 'Ravi',
    guardianContact: '9876543210',
    aadhaarLast4: '1234',
  };

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    schoolGet = vi.fn(async (path) => {
      if (path.startsWith('/students?')) {
        if (path.includes('status=active')) {
          return { items: [sampleStudent], total: 1 };
        }
        if (path.includes('class=')) {
          const m = /class=([^&]+)/.exec(path);
          const label = m ? decodeURIComponent(m[1]) : '';
          return { items: [], total: label === '5' ? 3 : 0 };
        }
        return { items: [sampleStudent], total: 1 };
      }
      if (path === '/students/stu-1') return { ...sampleStudent };
      if (path === '/students/stu-1/guardians') {
        return {
          guardians: [
            {
              id: 'g1',
              firstName: 'Meera',
              lastName: 'Rao',
              relation: 'mother',
              phone: '9876543210',
              isPrimary: true,
            },
          ],
        };
      }
      if (path === '/students/stu-1/consents') {
        return {
          consents: [
            {
              kind: 'apaar',
              state: 'not_sought',
            },
            {
              kind: 'photo',
              state: 'granted',
            },
            {
              kind: 'biometric',
              state: 'refused',
            },
            {
              kind: 'dpdp_processing',
              state: 'not_sought',
            },
            {
              kind: 'transport_gps',
              state: 'withdrawn',
            },
          ],
        };
      }
      if (path === '/guardians') {
        return {
          guardians: [
            {
              id: 'g1',
              firstName: 'Meera',
              lastName: 'Rao',
              relation: 'mother',
              phone: '9876543210',
            },
            {
              id: 'g2',
              firstName: 'Ravi',
              lastName: 'Rao',
              relation: 'father',
              phone: '9876543211',
            },
          ],
        };
      }
      if (path === '/consents/summary') {
        return {
          summary: {
            apaar: { granted: 1, refused: 0, not_sought: 0, withdrawn: 0 },
            dpdp_processing: { granted: 0, refused: 0, not_sought: 1, withdrawn: 0 },
            biometric: { granted: 0, refused: 1, not_sought: 0, withdrawn: 0 },
            photo: { granted: 1, refused: 0, not_sought: 0, withdrawn: 0 },
            transport_gps: { granted: 0, refused: 0, not_sought: 0, withdrawn: 1 },
          },
        };
      }
      if (path === '/sessions') {
        return {
          sessions: [{ id: 'sess-1', label: '2025-26', isCurrent: true }],
        };
      }
      return {};
    });

    schoolPost = vi.fn(async () => ({ id: 'new-1' }));
    schoolPatch = vi.fn(async () => ({ ...sampleStudent }));
    schoolDel = vi.fn(async () => ({}));
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(
          async () => null,
          {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            school: () => ({
              get: schoolGet,
              post: schoolPost,
              put: vi.fn(),
              patch: schoolPatch,
              del: schoolDel,
            }),
          },
        ),
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
        getSession: () => ({ email: 'admin@school.test', name: 'Admin' }),
      };
    });

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
    }));

    mod = await import('../../modules/school_students/school_students.js');
    mod.renderSchoolStudentsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('#ssStatTotal')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders toolbar, stats, and student list', () => {
    expect(document.querySelector('#ssToolbar')).toBeTruthy();
    expect(document.querySelector('#ssStatTotal').textContent).toBe('1');
    expect(document.querySelector('#ssStatActive').textContent).toBe('1');
    expect(document.querySelector('[data-class="5"]')).toBeTruthy();
    expect(document.getElementById('ssConsentSummary').textContent).toMatch(/apaar/);
    expect(document.querySelector('tr[data-student-id="stu-1"]')).toBeTruthy();
    expect(document.body.textContent).toMatch(/Asha Rao/);
  });

  it('loads via api.school identity client', () => {
    expect(schoolGet).toHaveBeenCalled();
    const paths = schoolGet.mock.calls.map((c) => c[0]);
    expect(paths.some((p) => String(p).startsWith('/students?'))).toBe(true);
    expect(paths).toContain('/consents/summary');
  });

  it('create validation blocks missing names and bad aadhaar', () => {
    expect(
      mod.validateStudentFields({
        admission_number: 'X',
        first_name: '',
        last_name: 'Rao',
        dob: '2015-01-01',
        admission_date: '2022-01-01',
        gender: 'female',
        status: 'active',
        category: 'GEN',
        mother_name: 'M',
        father_name: 'F',
        guardian_contact: '9876543210',
      }),
    ).toMatch(/first_name/);

    expect(
      mod.validateStudentFields({
        admission_number: 'X',
        first_name: 'A',
        last_name: 'Rao',
        dob: '2015-01-01',
        admission_date: '2022-01-01',
        gender: 'female',
        status: 'active',
        category: 'GEN',
        mother_name: 'M',
        father_name: 'F',
        guardian_contact: '9876543210',
        aadhaar_last4: '12',
      }),
    ).toMatch(/aadhaar_last4/);

    expect(
      mod.validateStudentFields({
        admission_number: 'X',
        first_name: 'A',
        last_name: 'Rao',
        dob: '2015-01-01',
        admission_date: '2022-01-01',
        gender: 'female',
        status: 'active',
        category: 'GEN',
        mother_name: 'M',
        father_name: 'F',
        guardian_contact: '9876543210',
        aadhaar_last4: '1234',
      }),
    ).toBeNull();
  });

  it('create form surfaces validation via toast', async () => {
    document.getElementById('ssNewBtn').click();
    await vi.waitFor(() => {
      expect(document.getElementById('ssSave')).toBeTruthy();
    });
    document.getElementById('ssSave').click();
    expect(toastFn).toHaveBeenCalled();
    const msg = String(toastFn.mock.calls[toastFn.mock.calls.length - 1][0]);
    expect(msg.length).toBeGreaterThan(0);
    expect(schoolPost).not.toHaveBeenCalled();
  });

  it('guardian max-4 message and client guard', async () => {
    schoolGet.mockImplementation(async (path) => {
      if (path === '/students/stu-1') return { ...sampleStudent };
      if (path === '/students/stu-1/guardians') {
        return {
          guardians: [1, 2, 3, 4].map((n) => ({
            id: 'g' + n,
            firstName: 'G' + n,
            lastName: 'X',
            relation: 'guardian',
            phone: '900000000' + n,
            isPrimary: n === 1,
          })),
        };
      }
      if (path === '/students/stu-1/consents') {
        return { consents: [{ kind: 'photo', state: 'not_sought' }] };
      }
      if (path === '/guardians') return { guardians: [] };
      if (path.startsWith('/students?')) return { items: [sampleStudent], total: 1 };
      if (path === '/consents/summary') return { summary: {} };
      if (path === '/sessions') return { sessions: [] };
      return {};
    });

    await mod.ssOpenDetail('stu-1');
    await vi.waitFor(() => {
      expect(document.getElementById('ssGuardianMaxNote')).toBeTruthy();
    });
    expect(document.getElementById('ssGuardianMaxNote').textContent).toMatch(/Maximum 4/);
    expect(document.getElementById('ssLinkBtn')).toBeNull();
  });

  it('consent transition UI shows refusal note and grant fields', async () => {
    await mod.ssOpenDetail('stu-1');
    await vi.waitFor(() => {
      expect(document.getElementById('ssConsentRefusalNote')).toBeTruthy();
    });
    expect(document.getElementById('ssConsentRefusalNote').textContent).toMatch(
      /Refusal does not block any service/,
    );

    expect(mod.allowedConsentTransitions('not_sought')).toEqual(['granted', 'refused']);
    expect(mod.allowedConsentTransitions('granted')).toEqual(['withdrawn']);
    expect(mod.allowedConsentTransitions('withdrawn')).toEqual([]);

    const grantBtn = document.querySelector(
      '[data-ss-consent-kind="apaar"][data-ss-consent-to="granted"]',
    );
    expect(grantBtn).toBeTruthy();
    grantBtn.click();
    await vi.waitFor(() => {
      expect(document.getElementById('ssCGuardian')).toBeTruthy();
    });
    expect(document.getElementById('ssCMethod')).toBeTruthy();
    expect(document.getElementById('ssCArtefact')).toBeTruthy();

    document.getElementById('ssCSave').click();
    expect(toastFn).toHaveBeenCalledWith(
      expect.stringMatching(/Guardian|artefact|verification/i),
      'error',
    );
  });

  it('shows error toast when list load fails', async () => {
    schoolGet.mockImplementation(async (path) => {
      if (path.startsWith('/students?') && !path.includes('class=') && !path.includes('status=active')) {
        return { _error: true, status: 500, message: 'identity down' };
      }
      if (path.includes('status=active')) return { items: [], total: 0 };
      if (path.includes('class=')) return { items: [], total: 0 };
      if (path === '/consents/summary') return { summary: {} };
      if (path === '/sessions') return { sessions: [] };
      return {};
    });

    await mod.ssLoadData();
    expect(toastFn).toHaveBeenCalledWith('identity down', 'error');
    expect(document.body.textContent).toMatch(/No students match/);
  });
});
