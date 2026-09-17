const { test, expect } = require('@playwright/test');

test.describe('Security IDOR Tests', () => {
  let hackerApi;

  test.beforeAll(async ({ playwright }) => {
    // Simulate an authenticated request by setting headers directly,
    // which bypasses the frontend but tests the backend's identity enforcement.
    hackerApi = await playwright.request.newContext({
      baseURL: 'http://localhost:8000',
      extraHTTPHeaders: {
        'x-user-email': 'hacker@test.com',
        'x-user-name': 'Hacker'
      }
    });
  });

  test.afterAll(async () => {
    await hackerApi.dispose();
  });

  test('Leaves: Client cannot blindly delete someone else\'s leave', async () => {
    const res = await hackerApi.post('/api/leave-delete', {
      data: { leaveId: '1' }
    });
    // Hacker doesn't own leave 1 (if it exists) or it's simply unauthorized
    expect([401, 403, 404, 400]).toContain(res.status());
  });

  test('Regularizations: Client cannot approve using their own email as approverEmail in body', async () => {
    const res = await hackerApi.put('/api/regularizations/1/approve', {
      data: { approverEmail: 'hacker@test.com', role: 'manager' } // Spoofing role & email
    });
    // Backend should ignore body.role and body.approverEmail and check DB for true manager/admin status
    expect([401, 403, 404, 400]).toContain(res.status());
  });
  
  test('BD Meetings: Cannot approve a meeting they don\'t manage', async () => {
    const res = await hackerApi.post('/api/bd-meetings/1/approve', {
      data: { approverEmail: 'hacker@test.com' } 
    });
    // Backend ignores body.approverEmail, uses hacker@test.com identity, and verifies if they are admin
    expect([401, 403, 404, 400]).toContain(res.status());
  });

  test('Profile: Cannot update another user\'s protected profile fields', async () => {
    const res = await hackerApi.put('/api/profile/victim@test.com', {
      data: { bankAccountNumber: 'HACKER_BANK' }
    });
    // Since hacker is not admin and not self, should fail
    expect(res.status()).not.toBe(200);
  });
});
