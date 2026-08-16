import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('documents module', () => {
  /** @type {typeof import('../../modules/documents/documents.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let apiPut;
  let apiDelete;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path === '/api/documents') {
        return {
          documents: [
            {
              id: 'd1',
              title: 'Leave Policy',
              category: 'policy',
              version: 1,
              status: 'draft',
              ack_required: 1,
              content: 'Rules…',
              file_id: 'file-1',
            },
          ],
        };
      }
      if (path === '/api/documents/my/pending-acks') {
        return {
          pending: [
            {
              document_id: 'd-pub',
              title: 'Code of Conduct',
              category: 'code_of_conduct',
              version: 2,
              file_id: 'file-2',
            },
          ],
          count: 1,
        };
      }
      if (path === '/api/storage/files/file-1' || path === '/api/storage/files/file-2') {
        return { id: path.split('/').pop(), original_name: 'policy.pdf' };
      }
      if (path === '/api/document-templates') {
        return {
          templates: [
            {
              id: 't1',
              name: 'Offer letter',
              category: 'offer_letter',
              content_template: 'Hello {{employee_name}}',
              description: 'Standard offer',
            },
          ],
        };
      }
      if (path === '/api/document-templates/variables') {
        return { variables: ['employee_name', 'company_name'] };
      }
      if (path === '/api/generated-documents' || path === '/api/generated-documents/mine') {
        return {
          documents: [
            {
              id: 'g1',
              template_name: 'Offer letter',
              template_category: 'offer_letter',
              target_email: 'alice@test.com',
              created_at: '2026-08-01 10:00:00',
            },
          ],
        };
      }
      return {};
    });

    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/documents') {
        return {
          document: {
            id: 'd-new',
            title: body.title,
            category: body.category,
            status: 'draft',
            version: 1,
            ack_required: body.ackRequired ? 1 : 0,
            content: body.content || '',
          },
        };
      }
      if (path.endsWith('/acknowledge')) {
        return { acknowledgment: { id: 1, document_id: 'd-pub' } };
      }
      if (path.endsWith('/publish') || path.endsWith('/archive') || path.endsWith('/version')) {
        return { success: true };
      }
      if (path.endsWith('/generate')) {
        return {
          content: 'Hello Alice',
          variables: {},
          record: { id: 'g-new', target_email: body.targetEmail },
        };
      }
      if (path.endsWith('/preview')) {
        return { content: 'Preview Hello', variables: {} };
      }
      if (path === '/api/document-templates') {
        return {
          template: {
            id: 't-new',
            name: body.name,
            category: body.category,
            content_template: body.contentTemplate,
          },
        };
      }
      return { success: true };
    });

    apiPut = vi.fn(async () => ({ success: true }));
    apiDelete = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'admin@test.com', is_admin: true, role: 'admin' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: {
        get: apiGet,
        post: apiPost,
        put: apiPut,
        delete: apiDelete,
      },
    }));

    mod = await import('../../modules/documents/documents.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads policies, templates, pending, and generated in parallel', async () => {
    mod.renderDocumentsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Leave Policy');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/documents');
    expect(apiGet).toHaveBeenCalledWith('/api/documents/my/pending-acks');
    expect(apiGet).toHaveBeenCalledWith('/api/document-templates');
    expect(apiGet).toHaveBeenCalledWith('/api/generated-documents');
    expect(document.body.textContent).toContain('Total Docs');
    expect(mod._getDocs()[0].title).toBe('Leave Policy');
    expect(mod._getDocs()[0].ackRequired).toBe(true);
    expect(mod._getDocs()[0].fileId).toBe('file-1');
    expect(document.body.textContent).toContain('Open');
  });

  it('creates a policy with title, category, and fileId', async () => {
    mod.renderDocumentsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/documents'));

    document.getElementById('docAddBtn').click();
    expect(document.body.textContent).toMatch(/Attachment|upload/i);
    document.getElementById('docF_title').value = 'Travel Policy';
    document.getElementById('docF_category').value = 'policy';
    document.getElementById('docF_content').value = 'Expenses…';
    document.getElementById('docF_ack').checked = true;
    document.getElementById('docF_file_id').value = 'file-xyz';
    document.getElementById('docSaveBtn').click();

    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    const call = apiPost.mock.calls.find((c) => c[0] === '/api/documents');
    expect(call).toBeTruthy();
    expect(call[1].title).toBe('Travel Policy');
    expect(call[1].category).toBe('policy');
    expect(call[1].ackRequired).toBe(true);
    expect(call[1].fileId).toBe('file-xyz');
    expect(call[1].name).toBeUndefined();
    expect(toastFn).toHaveBeenCalledWith('Created', 'success');
  });

  it('acknowledges a pending document by document_id', async () => {
    mod.renderDocumentsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getPending().length).toBe(1));

    document.querySelector('[data-tab="pending"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Code of Conduct');
    });

    document.querySelector('[data-action="acknowledge"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/documents/d-pub/acknowledge', {});
    });
    expect(toastFn).toHaveBeenCalledWith('Acknowledged', 'success');
  });

  it('generates from a template with targetEmail', async () => {
    mod.renderDocumentsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getTemplates().length).toBe(1));

    document.querySelector('[data-tab="templates"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Offer letter');
    });

    document.querySelector('[data-action="generate"]').click();
    document.getElementById('docG_email').value = 'alice@test.com';
    document.getElementById('docGenerateBtn').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/document-templates/t1/generate', {
        targetEmail: 'alice@test.com',
      });
    });
    expect(toastFn).toHaveBeenCalledWith('Generated', 'success');
  });

  it('normalizes snake_case document and pending fields', () => {
    const doc = mod._normalizeDoc({
      id: 'x',
      title: 'T',
      ack_required: 1,
      document_group_id: 'g1',
      status: 'published',
    });
    expect(doc.ackRequired).toBe(true);
    expect(doc.documentGroupId).toBe('g1');

    const pending = mod._normalizePending({
      document_id: 'doc-9',
      title: 'Handbook',
      category: 'handbook',
      version: 3,
    });
    expect(pending.id).toBe('doc-9');
    expect(pending.title).toBe('Handbook');
  });

  it('shows feature-off message when documents API returns 404', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/documents') {
        return { _error: true, status: 404, message: 'Not found' };
      }
      if (path === '/api/documents/my/pending-acks') {
        return { _error: true, status: 404, message: 'Not found' };
      }
      if (path === '/api/document-templates') return { templates: [] };
      if (path === '/api/document-templates/variables') return { variables: [] };
      if (path.startsWith('/api/generated-documents')) return { documents: [] };
      return {};
    });

    mod.renderDocumentsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/disabled for this workspace/i);
    });
  });
});
