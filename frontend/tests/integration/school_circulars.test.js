import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_circulars module', () => {
  /** @type {typeof import('../../modules/school_circulars/school_circulars.js')} */
  let mod;
  let engGet;
  let engPost;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    engGet = vi.fn(async () => ({
      messages: [
        {
          createdAt: '2025-09-10T12:00:00Z',
          guardianRef: 'g1',
          templateKey: 'general',
          renderedBody: 'Hello parents',
        },
      ],
    }));
    engPost = vi.fn(async () => ({ count: 2, messages: [{}, {}] }));
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', () => ({
      api: {
        school: () => ({
          get: engGet,
          post: engPost,
          put: vi.fn(),
          patch: vi.fn(),
          del: vi.fn(),
        }),
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));

    mod = await import('../../modules/school_circulars/school_circulars.js');
  });

  afterEach(() => {
    mod._resetState();
    vi.restoreAllMocks();
  });

  it('loads recent messages and sends circular', async () => {
    const root = document.getElementById('root');
    mod.renderSchoolCircularsPage(root);
    await new Promise((r) => setTimeout(r, 0));
    expect(engGet).toHaveBeenCalledWith('/messages');
    expect(root.textContent).toContain('Circulars');
    expect(root.textContent).toContain('Hello parents');

    const form = root.querySelector('#scircForm');
    form.querySelector('[name="section_ref"]').value = '8|A';
    form.querySelector('[name="title"]').value = 'Notice';
    form.querySelector('[name="body"]').value = 'Sports day Friday';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));

    expect(engPost).toHaveBeenCalledWith('/circulars', {
      section_ref: '8|A',
      title: 'Notice',
      body: 'Sports day Friday',
    });
    expect(toastFn).toHaveBeenCalled();
  });
});
