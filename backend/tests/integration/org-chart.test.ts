import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Org Chart Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    // Seed employees for reporting line and flight risk tests
    await seedMember(db, {
      email: 'ceo@shaavir.com',
      name: 'CEO',
      groupId: 'exec',
      groupName: 'Executive',
    });
    await seedMember(db, {
      email: 'vp@shaavir.com',
      name: 'VP Engineering',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
    await seedMember(db, {
      email: 'bob@shaavir.com',
      name: 'Bob',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Position CRUD ──

  describe('POST /api/org/positions', () => {
    it('creates a position successfully', async () => {
      const res = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Chief Executive Officer', level: 0 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.position.title).toBe('Chief Executive Officer');
      expect(res.body.position.level).toBe(0);
      expect(res.body.position.id).toBeDefined();
    });

    it('creates a child position with parent', async () => {
      const parent = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP Engineering', parentPositionId: parent.body.position.id, level: 1 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.position.parent_position_id).toBe(parent.body.position.id);
    });

    it('rejects missing title', async () => {
      const res = await request(app)
        .post('/api/org/positions')
        .send({ level: 0 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects non-existent parent position', async () => {
      const res = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP', parentPositionId: 'nonexistent-id' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Pp]arent/);
    });
  });

  describe('GET /api/org/positions', () => {
    it('lists all positions', async () => {
      await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO', level: 0 })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/org/positions')
        .send({ title: 'CTO', level: 1 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/positions')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.positions).toHaveLength(2);
    });
  });

  describe('GET /api/org/positions/:id', () => {
    it('returns a single position', async () => {
      const created = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO', description: 'Top role' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get(`/api/org/positions/${created.body.position.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.position.title).toBe('CEO');
      expect(res.body.position.description).toBe('Top role');
    });

    it('returns 404 for nonexistent position', async () => {
      const res = await request(app)
        .get('/api/org/positions/nonexistent')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/org/positions/:id', () => {
    it('updates a position title and description', async () => {
      const created = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP', level: 1 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/org/positions/${created.body.position.id}`)
        .send({ title: 'VP of Engineering', description: 'Leads engineering org' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const fetched = await request(app)
        .get(`/api/org/positions/${created.body.position.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.position.title).toBe('VP of Engineering');
      expect(fetched.body.position.description).toBe('Leads engineering org');
    });

    it('rejects self-parenting', async () => {
      const created = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/org/positions/${created.body.position.id}`)
        .send({ parentPositionId: created.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/own parent/);
    });

    it('rejects circular hierarchy via reparenting', async () => {
      const ceo = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO' })
        .set('X-User-Email', 'admin@shaavir.com');
      const vp = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP', parentPositionId: ceo.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      const dir = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Director', parentPositionId: vp.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      // Try to make CEO a child of Director → cycle
      const res = await request(app)
        .put(`/api/org/positions/${ceo.body.position.id}`)
        .send({ parentPositionId: dir.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Cc]ircular/);
    });
  });

  describe('DELETE /api/org/positions/:id', () => {
    it('deletes a position and reparents children', async () => {
      const ceo = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO' })
        .set('X-User-Email', 'admin@shaavir.com');
      const vp = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP', parentPositionId: ceo.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      const dir = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Director', parentPositionId: vp.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      // Delete VP → Director should reparent to CEO
      await request(app)
        .delete(`/api/org/positions/${vp.body.position.id}`)
        .set('X-User-Email', 'admin@shaavir.com');

      const dirFetched = await request(app)
        .get(`/api/org/positions/${dir.body.position.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(dirFetched.body.position.parent_position_id).toBe(ceo.body.position.id);
    });

    it('returns 400 for nonexistent position', async () => {
      const res = await request(app)
        .delete('/api/org/positions/nonexistent')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Hierarchy ──

  describe('GET /api/org/tree', () => {
    it('returns full org tree with holder info', async () => {
      const ceo = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO', maxHeadcount: 1 })
        .set('X-User-Email', 'admin@shaavir.com');

      // Assign ceo@shaavir.com to the CEO position
      await request(app)
        .put('/api/org/assign-position')
        .send({ email: 'ceo@shaavir.com', positionId: ceo.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/org/tree').set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.tree).toHaveLength(1);
      expect(res.body.tree[0].holder_emails).toContain('ceo@shaavir.com');
      expect(res.body.tree[0].holder_count).toBe(1);
    });
  });

  describe('GET /api/org/positions/:id/subtree', () => {
    it('returns subtree rooted at a position', async () => {
      const ceo = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP Eng', parentPositionId: ceo.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP Sales', parentPositionId: ceo.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get(`/api/org/positions/${ceo.body.position.id}/subtree`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.positions).toHaveLength(3); // CEO + 2 VPs
    });

    it('returns 404 for nonexistent position', async () => {
      const res = await request(app)
        .get('/api/org/positions/nonexistent/subtree')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/org/positions/:id/ancestors', () => {
    it('returns ancestor chain to root', async () => {
      const ceo = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CEO' })
        .set('X-User-Email', 'admin@shaavir.com');
      const vp = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP', parentPositionId: ceo.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      const dir = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Director', parentPositionId: vp.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get(`/api/org/positions/${dir.body.position.id}/ancestors`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.ancestors).toHaveLength(3);
      expect(res.body.ancestors[0].title).toBe('Director');
      expect(res.body.ancestors[2].title).toBe('CEO');
    });
  });

  // ── Reporting lines ──

  describe('PUT /api/org/reports-to', () => {
    it('sets a reporting line', async () => {
      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const mgr = await request(app)
        .get('/api/org/manager?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(mgr.body.managerEmail).toBe('vp@shaavir.com');
    });

    it('removes a manager with empty string', async () => {
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: '' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const mgr = await request(app)
        .get('/api/org/manager?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(mgr.body.managerEmail).toBe('');
    });

    it('rejects circular reporting chain', async () => {
      // vp → alice → bob → vp would be a cycle
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'bob@shaavir.com', managerEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'vp@shaavir.com', managerEmail: 'bob@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Cc]ircular/);
    });

    it('rejects self-reporting', async () => {
      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Cc]ircular/);
    });

    it('rejects nonexistent employee', async () => {
      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'ghost@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Ee]mployee not found/);
    });

    it('rejects nonexistent manager', async () => {
      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'ghost@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Mm]anager not found/);
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .put('/api/org/reports-to')
        .send({ managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/org/direct-reports', () => {
    it('returns direct reports and total subordinate count', async () => {
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'bob@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/direct-reports?email=vp@shaavir.com')
        .set('X-User-Email', 'vp@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.directReports).toHaveLength(2);
      expect(res.body.totalSubordinates).toBe(2);
    });

    it('counts nested subordinates in total', async () => {
      // CEO → VP → Alice
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'vp@shaavir.com', managerEmail: 'ceo@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/direct-reports?email=ceo@shaavir.com')
        .set('X-User-Email', 'ceo@shaavir.com');
      expect(res.body.directReports).toHaveLength(1); // VP only
      expect(res.body.totalSubordinates).toBe(2); // VP + Alice
    });

    it('requires email parameter', async () => {
      const res = await request(app)
        .get('/api/org/direct-reports')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Position assignment ──

  describe('PUT /api/org/assign-position', () => {
    it('assigns a member to a position', async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Senior Engineer' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put('/api/org/assign-position')
        .send({ email: 'alice@shaavir.com', positionId: pos.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('unassigns with null positionId', async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Lead' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put('/api/org/assign-position')
        .send({ email: 'alice@shaavir.com', positionId: pos.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put('/api/org/assign-position')
        .send({ email: 'alice@shaavir.com', positionId: null })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
    });

    it('rejects nonexistent position', async () => {
      const res = await request(app)
        .put('/api/org/assign-position')
        .send({ email: 'alice@shaavir.com', positionId: 'nonexistent' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Pp]osition not found/);
    });
  });

  // ── Succession planning ──

  describe('POST /api/org/succession', () => {
    let posId: string;

    beforeEach(async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'VP Engineering' })
        .set('X-User-Email', 'admin@shaavir.com');
      posId = pos.body.position.id;
    });

    it('creates a succession plan entry', async () => {
      const res = await request(app)
        .post('/api/org/succession')
        .send({
          positionId: posId,
          nomineeEmail: 'alice@shaavir.com',
          readiness: '1_year',
          notes: 'Strong candidate',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.plan.nominee_email).toBe('alice@shaavir.com');
      expect(res.body.plan.readiness).toBe('1_year');
    });

    it('rejects duplicate nominee for same position', async () => {
      await request(app)
        .post('/api/org/succession')
        .send({ positionId: posId, nomineeEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/org/succession')
        .send({ positionId: posId, nomineeEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already/);
    });

    it('rejects invalid readiness value', async () => {
      const res = await request(app)
        .post('/api/org/succession')
        .send({ positionId: posId, nomineeEmail: 'alice@shaavir.com', readiness: 'tomorrow' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/readiness/);
    });

    it('rejects nonexistent nominee', async () => {
      const res = await request(app)
        .post('/api/org/succession')
        .send({ positionId: posId, nomineeEmail: 'ghost@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Nn]ominee not found/);
    });
  });

  describe('GET /api/org/succession', () => {
    it('lists all succession plans with position titles', async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CTO' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/org/succession')
        .send({
          positionId: pos.body.position.id,
          nomineeEmail: 'alice@shaavir.com',
          readiness: 'ready_now',
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/succession')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.plans).toHaveLength(1);
      expect(res.body.plans[0].position_title).toBe('CTO');
    });
  });

  describe('PUT /api/org/succession/:id', () => {
    it('updates readiness level', async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CTO' })
        .set('X-User-Email', 'admin@shaavir.com');
      const plan = await request(app)
        .post('/api/org/succession')
        .send({
          positionId: pos.body.position.id,
          nomineeEmail: 'alice@shaavir.com',
          readiness: '2_year',
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/org/succession/${plan.body.plan.id}`)
        .send({ readiness: 'ready_now' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/org/succession/:id', () => {
    it('deletes a succession plan entry', async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'CTO' })
        .set('X-User-Email', 'admin@shaavir.com');
      const plan = await request(app)
        .post('/api/org/succession')
        .send({ positionId: pos.body.position.id, nomineeEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .delete(`/api/org/succession/${plan.body.plan.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);

      const list = await request(app)
        .get(`/api/org/succession/position/${pos.body.position.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(list.body.plans).toHaveLength(0);
    });

    it('returns 400 for nonexistent plan', async () => {
      const res = await request(app)
        .delete('/api/org/succession/99999')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Analytics ──

  describe('GET /api/org/span-of-control', () => {
    it('returns span-of-control per manager', async () => {
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'alice@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put('/api/org/reports-to')
        .send({ email: 'bob@shaavir.com', managerEmail: 'vp@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/span-of-control')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      const vpSpan = res.body.spans.find(
        (s: Record<string, unknown>) => s.email === 'vp@shaavir.com',
      );
      expect(vpSpan).toBeDefined();
      expect(vpSpan.direct_report_count).toBe(2);
    });
  });

  describe('GET /api/org/vacancies', () => {
    it('returns positions with unfilled headcount', async () => {
      await request(app)
        .post('/api/org/positions')
        .send({ title: 'Engineer', maxHeadcount: 3 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/vacancies')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.vacancies).toHaveLength(1);
      expect(res.body.vacancies[0].vacancies).toBe(3);
    });

    it('excludes fully staffed positions', async () => {
      const pos = await request(app)
        .post('/api/org/positions')
        .send({ title: 'Solo Lead', maxHeadcount: 1 })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put('/api/org/assign-position')
        .send({ email: 'alice@shaavir.com', positionId: pos.body.position.id })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/org/vacancies')
        .set('X-User-Email', 'admin@shaavir.com');
      const found = res.body.vacancies.find(
        (v: Record<string, unknown>) => v.title === 'Solo Lead',
      );
      expect(found).toBeUndefined();
    });
  });

  describe('GET /api/org/flight-risk', () => {
    it('returns flight risk scores for all active employees', async () => {
      const res = await request(app)
        .get('/api/org/flight-risk')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.scores.length).toBeGreaterThanOrEqual(4);
      // Each score has the required structure
      const score = res.body.scores[0];
      expect(score).toHaveProperty('email');
      expect(score).toHaveProperty('overall');
      expect(score).toHaveProperty('breakdown');
      expect(score).toHaveProperty('riskLevel');
      expect(['low', 'medium', 'high']).toContain(score.riskLevel);
    });

    it('filters by email', async () => {
      const res = await request(app)
        .get('/api/org/flight-risk?email=alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.scores).toHaveLength(1);
      expect(res.body.scores[0].email).toBe('alice@shaavir.com');
    });

    it('filters by groupId', async () => {
      const res = await request(app)
        .get('/api/org/flight-risk?groupId=engineering')
        .set('X-User-Email', 'admin@shaavir.com');
      // vp, alice, bob are in engineering
      expect(res.body.scores.length).toBeGreaterThanOrEqual(3);
      for (const s of res.body.scores) {
        expect(s.email).not.toBe('ceo@shaavir.com');
      }
    });

    it('scores higher risk for employee with poor attendance', async () => {
      // Seed 20 working days for alice, 5 present and 15 absent
      const today = new Date();
      for (let i = 1; i <= 20; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const status = i <= 5 ? 'out' : 'absent';
        await db.run(
          `INSERT OR IGNORE INTO attendance_daily (email, name, date, status, group_id)
           VALUES (?, ?, ?, ?, ?)`,
          ['alice@shaavir.com', 'Alice', dateStr, status, 'engineering'],
        );
      }

      // Seed bob with perfect attendance for comparison
      for (let i = 1; i <= 20; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        await db.run(
          `INSERT OR IGNORE INTO attendance_daily (email, name, date, status, group_id)
           VALUES (?, ?, ?, ?, ?)`,
          ['bob@shaavir.com', 'Bob', dateStr, 'out', 'engineering'],
        );
      }

      const res = await request(app)
        .get('/api/org/flight-risk')
        .set('X-User-Email', 'admin@shaavir.com');

      const aliceScore = res.body.scores.find(
        (s: Record<string, unknown>) => s.email === 'alice@shaavir.com',
      );
      const bobScore = res.body.scores.find(
        (s: Record<string, unknown>) => s.email === 'bob@shaavir.com',
      );
      expect(aliceScore.breakdown.attendance).toBeGreaterThan(bobScore.breakdown.attendance);
    });
  });
});
