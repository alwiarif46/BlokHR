const { test, expect } = require('@playwright/test');

test.describe('Meetings API Security & Lifecycle', () => {
  const baseURL = 'http://localhost:9999';
  const headersManager = { 'X-User-Email': 'manager@demo.com', 'X-User-Name': 'Manager' };
  const headersAdmin = { 'X-User-Email': 'admin@demo.com', 'X-User-Name': 'Admin' };
  const headersEmployee = { 'X-User-Email': 'emp@demo.com', 'X-User-Name': 'Emp' };
  const headersNoAuth = {};
  
  let bdMeetingId;
  let trackedMeetingId;

  // -- BD Meetings --

  test('Employee can submit BD meeting', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/bd-meetings`, {
      headers: headersEmployee,
      data: { email: 'emp@demo.com', name: 'Emp', client: 'Acme Corp', date: '2026-10-01', notes: 'Test', time: '', location: '' }
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    bdMeetingId = body.id;
    expect(bdMeetingId).toBeDefined();
  });

  test('Unauthenticated user cannot qualify', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/bd-meetings/${bdMeetingId}/qualify`, { headers: headersNoAuth });
    expect(res.status()).toBe(401);
  });

  test('Employee cannot qualify their own meeting', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/bd-meetings/${bdMeetingId}/qualify`, { headers: headersEmployee });
    expect(res.status()).toBe(403);
  });

  test('Manager can qualify meeting', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/bd-meetings/${bdMeetingId}/qualify`, { headers: headersManager });
    expect(res.ok()).toBeTruthy();
  });

  test('Manager cannot approve meeting', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/bd-meetings/${bdMeetingId}/approve`, { headers: headersManager });
    expect(res.status()).toBe(403);
  });

  test('Admin can approve qualified meeting', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/bd-meetings/${bdMeetingId}/approve`, { headers: headersAdmin });
    expect(res.ok()).toBeTruthy();
  });

  // -- Tracked Meetings --

  test('Employee can create tracked meeting without spoofing addedBy', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/meetings`, {
      headers: headersEmployee,
      data: { name: 'Demo', client: 'Acme', purpose: 'Sync', addedBy: 'admin@demo.com' } // malicious spoof
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    trackedMeetingId = body.id;
    
    // Verify it was saved as the employee, not admin
    const getRes = await request.get(`${baseURL}/api/meetings`, { headers: headersEmployee });
    const getBody = await getRes.json();
    const mtg = getBody.meetings.find(m => m.id === trackedMeetingId);
    expect(mtg.added_by).toBe('emp@demo.com');
  });

  test('Admin cannot delete employee meeting', async ({ request }) => {
    const res = await request.delete(`${baseURL}/api/meetings/${trackedMeetingId}`, { headers: headersAdmin });
    expect(res.status()).toBe(403); // Ownership check protects it even from admins
  });

  test('Employee can delete their own meeting', async ({ request }) => {
    const res = await request.delete(`${baseURL}/api/meetings/${trackedMeetingId}`, { headers: headersEmployee });
    expect(res.ok()).toBeTruthy();
  });
});
