import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Document Management Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
    await seedMember(db, { email: 'bob@shaavir.com', name: 'Bob' });
    // Seed joining date for template merging
    await db.run("UPDATE members SET joining_date = '2023-01-15' WHERE email = 'alice@shaavir.com'");
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Document CRUD ──

  describe('POST /api/documents', () => {
    it('creates a draft document', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Employee Handbook', category: 'handbook', content: 'Welcome to the company.' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.document.title).toBe('Employee Handbook');
      expect(res.body.document.status).toBe('draft');
      expect(res.body.document.version).toBe(1);
    });

    it('rejects missing title', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({ category: 'policy' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid category', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Test', category: 'invalid_cat' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/category/i);
    });
  });

  describe('GET /api/documents', () => {
    it('lists latest version per group', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Leave Policy', category: 'policy' })
        .set('X-User-Email', 'admin@shaavir.com');

      // Create version 2
      await request(app)
        .post(`/api/documents/${created.body.document.id}/version`)
        .send({ content: 'Updated content' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/documents')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].version).toBe(2);
    });

    it('filters by status', async () => {
      await request(app)
        .post('/api/documents')
        .send({ title: 'Draft Doc' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/documents?status=published')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.documents).toHaveLength(0);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('updates a draft document', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Old Title' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/documents/${created.body.document.id}`)
        .send({ title: 'New Title', content: 'New content' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const fetched = await request(app)
        .get(`/api/documents/${created.body.document.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.document.title).toBe('New Title');
    });

    it('rejects editing a published document', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Policy' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/documents/${created.body.document.id}`)
        .send({ title: 'Sneaky Edit' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Dd]raft/);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('deletes a draft', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Temp' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .delete(`/api/documents/${created.body.document.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const fetched = await request(app)
        .get(`/api/documents/${created.body.document.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.status).toBe(404);
    });

    it('rejects deleting a published document', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Policy' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .delete(`/api/documents/${created.body.document.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Publishing & Archiving ──

  describe('POST /api/documents/:id/publish', () => {
    it('publishes a draft', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Code of Conduct', category: 'code_of_conduct' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const fetched = await request(app)
        .get(`/api/documents/${created.body.document.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.document.status).toBe('published');
      expect(fetched.body.document.published_at).toBeTruthy();
    });

    it('rejects publishing an already published document', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Policy' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/documents/:id/archive', () => {
    it('archives a published document', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Old Policy' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${created.body.document.id}/archive`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const fetched = await request(app)
        .get(`/api/documents/${created.body.document.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.document.status).toBe('archived');
    });
  });

  // ── Versioning ──

  describe('POST /api/documents/:id/version', () => {
    it('creates version 2 with incremented number', async () => {
      const v1 = await request(app)
        .post('/api/documents')
        .send({ title: 'Handbook v1', content: 'Original' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${v1.body.document.id}/version`)
        .send({ content: 'Revised content' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.document.version).toBe(2);
      expect(res.body.document.document_group_id).toBe(v1.body.document.document_group_id);
    });
  });

  describe('GET /api/documents/:id/versions', () => {
    it('returns full version history', async () => {
      const v1 = await request(app)
        .post('/api/documents')
        .send({ title: 'Doc' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${v1.body.document.id}/version`)
        .send({})
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get(`/api/documents/${v1.body.document.id}/versions`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.versions).toHaveLength(2);
      expect(res.body.versions[0].version).toBe(2);
      expect(res.body.versions[1].version).toBe(1);
    });
  });

  // ── Acknowledgments ──

  describe('POST /api/documents/:id/acknowledge', () => {
    let docId: string;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Leave Policy', ackRequired: true })
        .set('X-User-Email', 'admin@shaavir.com');
      docId = created.body.document.id;
      await request(app)
        .post(`/api/documents/${docId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('acknowledges a published document', async () => {
      const res = await request(app)
        .post(`/api/documents/${docId}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.acknowledgment.email).toBe('alice@shaavir.com');
    });

    it('rejects duplicate acknowledgment', async () => {
      await request(app)
        .post(`/api/documents/${docId}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${docId}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Aa]lready/);
    });

    it('rejects acknowledging a draft', async () => {
      const draft = await request(app)
        .post('/api/documents')
        .send({ title: 'Draft', ackRequired: true })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${draft.body.document.id}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects acknowledging a doc without ack_required', async () => {
      const noAck = await request(app)
        .post('/api/documents')
        .send({ title: 'Info Doc', ackRequired: false })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${noAck.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/documents/${noAck.body.document.id}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not require/);
    });
  });

  describe('GET /api/documents/:id/acknowledgments', () => {
    it('returns ack report with acked and unacked members', async () => {
      const created = await request(app)
        .post('/api/documents')
        .send({ title: 'Policy', ackRequired: true })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${created.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${created.body.document.id}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get(`/api/documents/${created.body.document.id}/acknowledgments`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      const aliceEntry = res.body.report.find((r: Record<string, unknown>) => r.email === 'alice@shaavir.com');
      expect(aliceEntry.acked_at).toBeTruthy();
      const bobEntry = res.body.report.find((r: Record<string, unknown>) => r.email === 'bob@shaavir.com');
      expect(bobEntry.acked_at).toBeNull();
    });
  });

  describe('GET /api/documents/my/pending-acks', () => {
    it('returns pending acks for the current user', async () => {
      const doc = await request(app)
        .post('/api/documents')
        .send({ title: 'Must Read', ackRequired: true })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${doc.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/documents/my/pending-acks')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.pending).toHaveLength(1);
    });

    it('returns zero after acknowledging', async () => {
      const doc = await request(app)
        .post('/api/documents')
        .send({ title: 'Must Read', ackRequired: true })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${doc.body.document.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/documents/${doc.body.document.id}/acknowledge`)
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get('/api/documents/my/pending-acks')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.count).toBe(0);
    });
  });

  // ── Templates ──

  describe('POST /api/document-templates', () => {
    it('creates a template', async () => {
      const res = await request(app)
        .post('/api/document-templates')
        .send({
          name: 'Offer Letter',
          category: 'offer_letter',
          contentTemplate: 'Dear {{employee_name}}, we are pleased to offer you the position of {{designation}}.',
          description: 'Standard offer letter',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.template.name).toBe('Offer Letter');
      expect(res.body.template.category).toBe('offer_letter');
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/document-templates')
        .send({ contentTemplate: 'Hello' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing contentTemplate', async () => {
      const res = await request(app)
        .post('/api/document-templates')
        .send({ name: 'Test' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/document-templates', () => {
    it('lists templates', async () => {
      await request(app)
        .post('/api/document-templates')
        .send({ name: 'T1', contentTemplate: 'Hello', category: 'offer_letter' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/document-templates')
        .send({ name: 'T2', contentTemplate: 'World', category: 'warning_letter' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/document-templates')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.templates).toHaveLength(2);
    });

    it('filters by category', async () => {
      await request(app)
        .post('/api/document-templates')
        .send({ name: 'T1', contentTemplate: 'A', category: 'offer_letter' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/document-templates')
        .send({ name: 'T2', contentTemplate: 'B', category: 'warning_letter' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/document-templates?category=offer_letter')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.templates).toHaveLength(1);
      expect(res.body.templates[0].name).toBe('T1');
    });
  });

  describe('GET /api/document-templates/variables', () => {
    it('returns available variable names', async () => {
      const res = await request(app)
        .get('/api/document-templates/variables')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.variables).toContain('employee_name');
      expect(res.body.variables).toContain('joining_date');
      expect(res.body.variables).toContain('tenure_years');
    });
  });

  describe('PUT /api/document-templates/:id', () => {
    it('updates a template', async () => {
      const created = await request(app)
        .post('/api/document-templates')
        .send({ name: 'Old', contentTemplate: 'Old text' })
        .set('X-User-Email', 'admin@shaavir.com');

      await request(app)
        .put(`/api/document-templates/${created.body.template.id}`)
        .send({ name: 'Updated', contentTemplate: 'New text' })
        .set('X-User-Email', 'admin@shaavir.com');

      const fetched = await request(app)
        .get(`/api/document-templates/${created.body.template.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.template.name).toBe('Updated');
    });
  });

  describe('DELETE /api/document-templates/:id', () => {
    it('deletes a template', async () => {
      const created = await request(app)
        .post('/api/document-templates')
        .send({ name: 'Temp', contentTemplate: 'X' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .delete(`/api/document-templates/${created.body.template.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const fetched = await request(app)
        .get(`/api/document-templates/${created.body.template.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.status).toBe(404);
    });
  });

  // ── Generation ──

  describe('POST /api/document-templates/:id/generate', () => {
    it('generates a document with merged variables', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({
          name: 'Experience Certificate',
          category: 'experience_certificate',
          contentTemplate: 'This certifies that {{employee_name}} joined on {{joining_date}} and has {{tenure_years}} years of experience.',
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.content).toContain('Alice');
      expect(res.body.content).toContain('2023-01-15');
      expect(res.body.record.target_email).toBe('alice@shaavir.com');
    });

    it('processes conditionals in templates', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({
          name: 'Conditional',
          contentTemplate: '{{if:tenure_years > 1}}Experienced{{else}}New hire{{/if}}',
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.content).toBe('Experienced');
    });

    it('processes formula bridge', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({
          name: 'Formula',
          contentTemplate: 'Tenure: {{formula:tenure:joining_date}} years',
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.content).toMatch(/Tenure: [\d.]+ years/);
    });

    it('rejects nonexistent target employee', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({ name: 'T', contentTemplate: '{{employee_name}}' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'ghost@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing targetEmail', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({ name: 'T', contentTemplate: 'X' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({})
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/document-templates/:id/preview', () => {
    it('previews merge without saving', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({ name: 'Preview', contentTemplate: 'Hello {{employee_name}}' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/preview`)
        .send({ targetEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.content).toBe('Hello Alice');
      expect(res.body.variables.employee_name).toBe('Alice');

      // Verify nothing was saved
      const generated = await request(app)
        .get('/api/generated-documents')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(generated.body.documents).toHaveLength(0);
    });
  });

  describe('GET /api/generated-documents', () => {
    it('lists generated documents', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({ name: 'T', contentTemplate: '{{employee_name}}' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/generated-documents')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].template_name).toBe('T');
    });
  });

  describe('GET /api/generated-documents/mine', () => {
    it('returns generated documents for current user', async () => {
      const tmpl = await request(app)
        .post('/api/document-templates')
        .send({ name: 'Cert', contentTemplate: 'For {{employee_name}}' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/document-templates/${tmpl.body.template.id}/generate`)
        .send({ targetEmail: 'bob@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/generated-documents/mine')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].target_email).toBe('alice@shaavir.com');
    });
  });
});
