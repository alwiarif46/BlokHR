import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Training / LMS Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
    await seedMember(db, { email: 'bob@shaavir.com', name: 'Bob' });
  });

  afterEach(async () => { await db.close(); });

  // ── Courses ──

  describe('POST /api/training/courses', () => {
    it('creates a course', async () => {
      const res = await request(app)
        .post('/api/training/courses')
        .send({ title: 'Onboarding 101', category: 'onboarding', durationMinutes: 120, mandatory: true })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.course.title).toBe('Onboarding 101');
      expect(res.body.course.mandatory).toBe(1);
    });

    it('rejects missing title', async () => {
      const res = await request(app)
        .post('/api/training/courses')
        .send({ category: 'general' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid format', async () => {
      const res = await request(app)
        .post('/api/training/courses')
        .send({ title: 'Test', format: 'podcast' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/format/i);
    });
  });

  describe('GET /api/training/courses', () => {
    it('lists active courses', async () => {
      await request(app).post('/api/training/courses')
        .send({ title: 'Course A' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).post('/api/training/courses')
        .send({ title: 'Course B' }).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/training/courses')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.courses).toHaveLength(2);
    });
  });

  describe('DELETE /api/training/courses/:id', () => {
    it('deletes a course', async () => {
      const created = await request(app).post('/api/training/courses')
        .send({ title: 'Temp' }).set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).delete(`/api/training/courses/${created.body.course.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
    });
  });

  // ── Enrollment ──

  describe('POST /api/training/enroll', () => {
    let courseId: string;
    beforeEach(async () => {
      const c = await request(app).post('/api/training/courses')
        .send({ title: 'Safety Training' }).set('X-User-Email', 'admin@shaavir.com');
      courseId = c.body.course.id;
    });

    it('enrolls an employee in a course', async () => {
      const res = await request(app).post('/api/training/enroll')
        .send({ courseId, email: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.enrollment.status).toBe('enrolled');
    });

    it('rejects duplicate enrollment', async () => {
      await request(app).post('/api/training/enroll')
        .send({ courseId, email: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).post('/api/training/enroll')
        .send({ courseId, email: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Aa]lready enrolled/);
    });

    it('rejects enrollment of inactive employee', async () => {
      const res = await request(app).post('/api/training/enroll')
        .send({ courseId, email: 'ghost@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/training/enrollments/:id/progress', () => {
    let enrollmentId: string;
    beforeEach(async () => {
      const c = await request(app).post('/api/training/courses')
        .send({ title: 'Course' }).set('X-User-Email', 'admin@shaavir.com');
      const e = await request(app).post('/api/training/enroll')
        .send({ courseId: c.body.course.id, email: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      enrollmentId = e.body.enrollment.id;
    });

    it('updates progress and transitions to in_progress', async () => {
      const res = await request(app)
        .put(`/api/training/enrollments/${enrollmentId}/progress`)
        .send({ progress: 50 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);

      const my = await request(app).get('/api/training/my-courses')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(my.body.enrollments[0].status).toBe('in_progress');
      expect(my.body.enrollments[0].progress_pct).toBe(50);
    });

    it('completes at 100% progress', async () => {
      await request(app)
        .put(`/api/training/enrollments/${enrollmentId}/progress`)
        .send({ progress: 100, score: 95 })
        .set('X-User-Email', 'alice@shaavir.com');

      const my = await request(app).get('/api/training/my-courses')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(my.body.enrollments[0].status).toBe('completed');
      expect(my.body.enrollments[0].score).toBe(95);
    });

    it('grants skills on completion', async () => {
      // Create a skill, link it to the course
      const skill = await request(app).post('/api/training/skills')
        .send({ name: 'Safety Awareness' }).set('X-User-Email', 'admin@shaavir.com');

      // Find the course from the enrollment
      const my = await request(app).get('/api/training/my-courses')
        .set('X-User-Email', 'alice@shaavir.com');
      const courseId = my.body.enrollments[0].course_id;

      await request(app).post(`/api/training/courses/${courseId}/skills`)
        .send({ skillId: skill.body.skill.id, proficiency: 'intermediate' })
        .set('X-User-Email', 'admin@shaavir.com');

      // Complete the course
      await request(app)
        .put(`/api/training/enrollments/${enrollmentId}/progress`)
        .send({ progress: 100 })
        .set('X-User-Email', 'alice@shaavir.com');

      const skills = await request(app)
        .get('/api/training/skills/employee?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(skills.body.skills).toHaveLength(1);
      expect(skills.body.skills[0].skill_name).toBe('Safety Awareness');
      expect(skills.body.skills[0].proficiency).toBe('intermediate');
    });
  });

  describe('GET /api/training/courses/:id/completion-report', () => {
    it('returns completion stats', async () => {
      const c = await request(app).post('/api/training/courses')
        .send({ title: 'Report Course' }).set('X-User-Email', 'admin@shaavir.com');
      const e1 = await request(app).post('/api/training/enroll')
        .send({ courseId: c.body.course.id, email: 'alice@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app).post('/api/training/enroll')
        .send({ courseId: c.body.course.id, email: 'bob@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app).put(`/api/training/enrollments/${e1.body.enrollment.id}/progress`)
        .send({ progress: 100 }).set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get(`/api/training/courses/${c.body.course.id}/completion-report`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.report.totalEnrolled).toBe(2);
      expect(res.body.report.completed).toBe(1);
      expect(res.body.report.completionRate).toBe(50);
    });
  });

  // ── Skills ──

  describe('Skills management', () => {
    it('creates and lists skills', async () => {
      await request(app).post('/api/training/skills')
        .send({ name: 'Python', category: 'technical' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).get('/api/training/skills')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.skills).toHaveLength(1);
      expect(res.body.skills[0].name).toBe('Python');
    });

    it('sets employee skill manually', async () => {
      const skill = await request(app).post('/api/training/skills')
        .send({ name: 'Leadership' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).put('/api/training/skills/employee')
        .send({ email: 'alice@shaavir.com', skillId: skill.body.skill.id, proficiency: 'advanced' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/training/skills/employee?email=alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.skills).toHaveLength(1);
      expect(res.body.skills[0].proficiency).toBe('advanced');
    });
  });

  // ── Budgets ──

  describe('Training budgets', () => {
    it('sets and retrieves a budget', async () => {
      await request(app).put('/api/training/budgets')
        .send({ groupId: 'engineering', year: 2026, annualBudget: 50000, perEmployeeCap: 5000 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/training/budgets?groupId=engineering&year=2026')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.budget.annual_budget).toBe(50000);
      expect(res.body.budget.per_employee_cap).toBe(5000);
    });
  });

  // ── External training requests ──

  describe('POST /api/training/external-requests', () => {
    it('submits an external training request', async () => {
      const res = await request(app).post('/api/training/external-requests')
        .send({ email: 'alice@shaavir.com', name: 'Alice', title: 'AWS Certification', provider: 'AWS', cost: 300 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.request.status).toBe('pending');
    });

    it('rejects if cost exceeds budget', async () => {
      await request(app).put('/api/training/budgets')
        .send({ groupId: 'engineering', year: new Date().getFullYear(), annualBudget: 100, perEmployeeCap: 50 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).post('/api/training/external-requests')
        .send({ email: 'alice@shaavir.com', name: 'Alice', title: 'Expensive Course', cost: 200 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Bb]udget|[Cc]ap/);
    });
  });

  describe('External request approval flow', () => {
    let reqId: string;
    beforeEach(async () => {
      const r = await request(app).post('/api/training/external-requests')
        .send({ email: 'alice@shaavir.com', name: 'Alice', title: 'Conference', cost: 500 })
        .set('X-User-Email', 'alice@shaavir.com');
      reqId = r.body.request.id;
    });

    it('manager approves: pending -> manager_approved', async () => {
      const res = await request(app)
        .post(`/api/training/external-requests/${reqId}/approve`)
        .send({ role: 'manager' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('HR approves after manager: manager_approved -> approved', async () => {
      await request(app).post(`/api/training/external-requests/${reqId}/approve`)
        .send({ role: 'manager' }).set('X-User-Email', 'mgr@shaavir.com');
      const res = await request(app).post(`/api/training/external-requests/${reqId}/approve`)
        .send({ role: 'hr' }).set('X-User-Email', 'hr@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('rejects HR approve before manager', async () => {
      const res = await request(app).post(`/api/training/external-requests/${reqId}/approve`)
        .send({ role: 'hr' }).set('X-User-Email', 'hr@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects a request', async () => {
      const res = await request(app).post(`/api/training/external-requests/${reqId}/reject`)
        .send({ reason: 'Not aligned with goals' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);
    });
  });
});
