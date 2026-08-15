import type { Logger } from 'pino';
import type { DatabaseEngine } from '../../db/engine';
import { ClockRepository } from '../../repositories/clock-repository';
import { ClockService } from '../clock-service';
import { LeaveRepository } from '../../repositories/leave-repository';
import { LeaveService } from '../leave-service';
import { RegularizationRepository } from '../../repositories/regularization-repository';
import { RegularizationService } from '../regularization-service';
import { OvertimeRepository } from '../../repositories/overtime-repository';
import { OvertimeService } from '../overtime-service';
import { TimesheetRepository } from '../../repositories/timesheet-repository';
import { TimesheetService } from '../timesheet-service';
import { AnalyticsRepository } from '../../repositories/analytics-repository';
import { AnalyticsService } from '../analytics-service';
import { BdMeetingRepository } from '../../repositories/bd-meeting-repository';
import { BdMeetingService } from '../bd-meeting-service';
import { TimeTrackingRepository } from '../../repositories/time-tracking-repository';
import { SettingsRepository } from '../../repositories/settings-repository';
import { SettingsService } from '../settings-service';
import { MeetingRepository } from '../../repositories/meeting-repository';
import { v4 as uuidv4 } from 'uuid';

type Params = Record<string, unknown>;
type Handler = (params: Params, callerEmail: string) => Promise<unknown>;

function today(): string { return new Date().toISOString().slice(0, 10); }
function thisMonth(): string { return today().slice(0, 7); }
function currentQuarter(): { start: string; end: string } {
  const now = new Date(); const q = Math.floor(now.getMonth() / 3); const y = now.getFullYear();
  return { start: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, end: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10) };
}
function parseShiftMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
  let s = sh * 60 + (sm || 0), e = eh * 60 + (em || 0); if (e <= s) e += 1440; return e - s;
}
function countWeekdays(startStr: string, endStr: string): number {
  const s = new Date(startStr + 'T00:00:00Z'), e = new Date(endStr + 'T00:00:00Z'); let c = 0;
  const cur = new Date(s); while (cur <= e) { const d = cur.getUTCDay(); if (d !== 0 && d !== 6) c++; cur.setUTCDate(cur.getUTCDate() + 1); } return c;
}

export function buildHandlerMap(db: DatabaseEngine, logger: Logger): Map<string, Handler> {
  const clockRepo = new ClockRepository(db);
  const clockService = new ClockService(clockRepo, logger);
  const leaveRepo = new LeaveRepository(db);
  const leaveService = new LeaveService(leaveRepo, logger);
  const regRepo = new RegularizationRepository(db);
  const regService = new RegularizationService(regRepo, clockRepo, db, null, logger);
  const otRepo = new OvertimeRepository(db);
  const otService = new OvertimeService(otRepo, clockRepo, db, logger);
  const tsRepo = new TimesheetRepository(db);
  const tsService = new TimesheetService(tsRepo, logger);
  const analyticsRepo = new AnalyticsRepository(db);
  const analyticsService = new AnalyticsService(analyticsRepo, logger);
  const bdRepo = new BdMeetingRepository(db);
  const bdService = new BdMeetingService(bdRepo, db, null, logger);
  const ttRepo = new TimeTrackingRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const meetingRepo = new MeetingRepository(db);
  const settingsService = new SettingsService(settingsRepo, leaveRepo, regRepo, bdRepo, meetingRepo, logger);

  const h = new Map<string, Handler>();
  const getName = async (email: string): Promise<string> => {
    const r = await db.get<{ name: string; [key: string]: unknown }>('SELECT name FROM members WHERE email = ?', [email]);
    return r?.name ?? email;
  };

  // CLOCK
  const doClock = async (action: string, email: string): Promise<unknown> => clockService.clock(action, email, await getName(email), 'bot');
  h.set('clock_in', async (_p, e) => doClock('in', e));
  h.set('clock_out', async (_p, e) => doClock('out', e));
  h.set('clock_break', async (_p, e) => doClock('break', e));
  h.set('clock_back', async (_p, e) => doClock('back', e));

  // MY ATTENDANCE
  h.set('my_attendance_today', async (_p, e) => db.get('SELECT * FROM attendance_daily WHERE email = ? AND date = ?', [e, today()]));
  h.set('my_attendance_for_date', async (p, e) => db.get('SELECT * FROM attendance_daily WHERE email = ? AND date = ?', [e, p.date]));
  h.set('my_attendance_range', async (p, e) => db.all('SELECT * FROM attendance_daily WHERE email = ? AND date >= ? AND date <= ? ORDER BY date', [e, p.startDate, p.endDate]));
  h.set('am_i_late_today', async (_p, e) => {
    const r = await db.get<{ is_late: number; late_minutes: number; [key: string]: unknown }>('SELECT is_late, late_minutes FROM attendance_daily WHERE email = ? AND date = ?', [e, today()]);
    return r ? { isLate: r.is_late === 1, lateMinutes: r.late_minutes } : { isLate: false, message: 'No attendance record yet' };
  });
  h.set('my_late_count_month', async (p, e) => {
    const m = (p.month as string) || thisMonth();
    const r = await db.get<{ late_count: number; [key: string]: unknown }>('SELECT late_count FROM monthly_late_counts WHERE email = ? AND year_month = ?', [e, m]);
    return { month: m, lateCount: r?.late_count ?? 0 };
  });
  h.set('my_worked_hours_today', async (_p, e) => {
    const r = await db.get<{ total_worked_minutes: number; [key: string]: unknown }>('SELECT total_worked_minutes FROM attendance_daily WHERE email = ? AND date = ?', [e, today()]);
    const min = r?.total_worked_minutes ?? 0; return { workedMinutes: min, workedHours: Math.round(min / 60 * 10) / 10 };
  });
  h.set('my_worked_hours_range', async (p, e) => {
    const r = await db.get<{ total: number; [key: string]: unknown }>('SELECT COALESCE(SUM(total_worked_minutes), 0) as total FROM attendance_daily WHERE email = ? AND date >= ? AND date <= ?', [e, p.startDate, p.endDate]);
    const min = r?.total ?? 0; return { startDate: p.startDate, endDate: p.endDate, workedMinutes: min, workedHours: Math.round(min / 60 * 10) / 10 };
  });
  h.set('my_break_time_today', async (_p, e) => {
    const r = await db.get<{ total_break_minutes: number; [key: string]: unknown }>('SELECT total_break_minutes FROM attendance_daily WHERE email = ? AND date = ?', [e, today()]);
    return { breakMinutes: r?.total_break_minutes ?? 0 };
  });
  h.set('my_clock_events_today', async (_p, e) => db.all('SELECT event_type, event_time, source FROM clock_events WHERE email = ? AND date = ? ORDER BY event_time', [e, today()]));
  h.set('my_clock_events_for_date', async (p, e) => db.all('SELECT event_type, event_time, source FROM clock_events WHERE email = ? AND date = ? ORDER BY event_time', [e, p.date]));

  // MY REGULARIZATION
  h.set('submit_regularization', async (p, e) => regService.submit({ email: e, name: await getName(e), date: p.date as string, correctionType: (p.correctionType as string) || 'time_correction', inTime: (p.inTime as string) || '', outTime: (p.outTime as string) || '', reason: p.reason as string }));
  h.set('my_regularizations', async (_p, e) => db.all('SELECT * FROM regularizations WHERE email = ? ORDER BY created_at DESC', [e]));
  h.set('my_pending_regularizations', async (_p, e) => db.all("SELECT * FROM regularizations WHERE email = ? AND status = 'pending' ORDER BY created_at DESC", [e]));
  h.set('regularization_status', async (p) => db.get('SELECT * FROM regularizations WHERE id = ?', [p.id]));

  // MY LEAVES
  h.set('my_leave_balance', async (_p, e) => db.all('SELECT leave_type, accrued, used, carry_forward FROM pto_balances WHERE email = ? AND year = ?', [e, new Date().getFullYear()]));
  h.set('my_leave_balance_by_type', async (p, e) => { const r = await db.get('SELECT * FROM pto_balances WHERE email = ? AND year = ? AND leave_type = ?', [e, new Date().getFullYear(), p.leaveType]); return r ?? { message: `No balance for ${p.leaveType}` }; });
  h.set('request_leave', async (p, e) => leaveService.submit({ personEmail: e, personName: await getName(e), leaveType: p.leaveType as string, startDate: p.startDate as string, endDate: p.endDate as string, kind: (p.kind as string) || 'FullDay', reason: (p.reason as string) || '' }));
  h.set('cancel_my_leave', async (p, e) => leaveService.deleteOrCancel(p.id as string, e));
  h.set('my_leave_requests', async (_p, e) => db.all('SELECT * FROM leave_requests WHERE person_email = ? ORDER BY created_at DESC', [e]));
  h.set('my_pending_leaves', async (_p, e) => db.all("SELECT * FROM leave_requests WHERE person_email = ? AND status IN ('Pending', 'Approved by Manager') ORDER BY created_at DESC", [e]));
  h.set('my_upcoming_leaves', async (_p, e) => db.all("SELECT * FROM leave_requests WHERE person_email = ? AND status = 'Approved' AND start_date >= ? ORDER BY start_date", [e, today()]));
  h.set('my_leave_history', async (p, e) => db.all('SELECT * FROM leave_requests WHERE person_email = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date', [e, p.endDate, p.startDate]));

  // MY TIME TRACKING
  h.set('log_time_entry', async (p, e) => ttRepo.createEntry({ email: e, projectId: p.projectId as string, date: p.date as string, hours: p.hours as number, description: (p.description as string) || '', billable: p.billable !== false }));
  h.set('my_time_entries_today', async (_p, e) => ttRepo.getEntries({ email: e, startDate: today(), endDate: today() }));
  h.set('my_time_entries_range', async (p, e) => ttRepo.getEntries({ email: e, startDate: p.startDate as string, endDate: p.endDate as string }));
  h.set('my_billable_summary', async (p, e) => ttRepo.getSummary({ email: e, startDate: p.startDate as string, endDate: p.endDate as string }));
  h.set('list_projects', async () => ttRepo.getProjects());
  h.set('list_clients', async () => ttRepo.getClients());
  h.set('delete_my_time_entry', async (p, e) => { const entry = await ttRepo.getEntryById(Number(p.id)); if (!entry) return { success: false, error: 'Not found' }; if (entry.email !== e) return { success: false, error: 'Not your entry' }; if (entry.approved) return { success: false, error: 'Cannot delete approved entry' }; await ttRepo.deleteEntry(Number(p.id)); return { success: true }; });

  // MY OVERTIME
  h.set('my_overtime_records', async (p, e) => otService.getByEmail(e, p.startDate as string | undefined, p.endDate as string | undefined));
  h.set('my_overtime_summary', async (p, e) => otService.getSummary(e, p.startDate as string, p.endDate as string));
  h.set('my_ot_remaining_quarter', async (_p, e) => { const q = currentQuarter(); const s = await otService.getSummary(e, q.start, q.end) as { totalOtMinutes?: number }; const cap = await db.get<{ ot_max_quarterly_hours: number; [key: string]: unknown }>('SELECT ot_max_quarterly_hours FROM system_settings WHERE id = 1', []); const capH = cap?.ot_max_quarterly_hours ?? 125; const usedH = Math.round((s?.totalOtMinutes ?? 0) / 60 * 10) / 10; return { quarterStart: q.start, quarterEnd: q.end, capHours: capH, usedHours: usedH, remainingHours: Math.max(0, capH - usedH) }; });
  h.set('my_overtime_for_date', async (p, e) => db.all('SELECT * FROM overtime_records WHERE email = ? AND date = ?', [e, p.date]));

  // MY TIMESHEETS
  h.set('my_timesheets', async (_p, e) => tsService.list({ email: e }));
  h.set('generate_my_timesheet', async (p, e) => tsService.generate(e, p.periodType as string, p.startDate as string));
  h.set('submit_my_timesheet', async (p, e) => tsService.submit(p.id as string, e));
  h.set('my_timesheet_detail', async (p) => tsService.getDetail(p.id as string));

  // MY PROFILE
  h.set('my_profile', async (_p, e) => db.get('SELECT email, name, designation, group_id, member_type_id, role, phone, joining_date, location, timezone, individual_shift_start, individual_shift_end FROM members WHERE email = ?', [e]));
  h.set('my_shift', async (_p, e) => { const m = await db.get<{ individual_shift_start: string | null; individual_shift_end: string | null; group_id: string; [key: string]: unknown }>('SELECT individual_shift_start, individual_shift_end, group_id FROM members WHERE email = ?', [e]); if (!m) return { error: 'Not found' }; if (m.individual_shift_start && m.individual_shift_end) return { type: 'individual', start: m.individual_shift_start, end: m.individual_shift_end }; const g = await db.get<{ shift_start: string; shift_end: string; name: string; [key: string]: unknown }>('SELECT shift_start, shift_end, name FROM groups WHERE id = ?', [m.group_id]); return { type: 'group', groupName: g?.name, start: g?.shift_start, end: g?.shift_end }; });
  h.set('my_department', async (_p, e) => { const r = await db.get<{ group_id: string; [key: string]: unknown }>('SELECT group_id FROM members WHERE email = ?', [e]); if (!r?.group_id) return { department: 'Unassigned' }; const g = await db.get<{ name: string; [key: string]: unknown }>('SELECT name FROM groups WHERE id = ?', [r.group_id]); return { departmentId: r.group_id, departmentName: g?.name }; });
  h.set('my_joining_date', async (_p, e) => { const r = await db.get<{ joining_date: string; [key: string]: unknown }>('SELECT joining_date FROM members WHERE email = ?', [e]); return { joiningDate: r?.joining_date || 'Not set' }; });

  // MY TARGETS
  h.set('my_attendance_target', async (p, e) => { const m = await db.get<{ individual_shift_start: string | null; individual_shift_end: string | null; group_id: string; [key: string]: unknown }>('SELECT individual_shift_start, individual_shift_end, group_id FROM members WHERE email = ?', [e]); let sm = 540; if (m?.individual_shift_start && m?.individual_shift_end) sm = parseShiftMinutes(m.individual_shift_start, m.individual_shift_end); else if (m?.group_id) { const g = await db.get<{ shift_start: string; shift_end: string; [key: string]: unknown }>('SELECT shift_start, shift_end FROM groups WHERE id = ?', [m.group_id]); if (g) sm = parseShiftMinutes(g.shift_start, g.shift_end); } const a = await db.get<{ total: number; days: number; [key: string]: unknown }>(`SELECT COALESCE(SUM(total_worked_minutes), 0) as total, COUNT(*) as days FROM attendance_daily WHERE email = ? AND date >= ? AND date <= ? AND status IN ('in', 'out', 'break')`, [e, p.startDate, p.endDate]); const wd = countWeekdays(p.startDate as string, p.endDate as string); const expM = wd * sm; const actM = a?.total ?? 0; return { startDate: p.startDate, endDate: p.endDate, workdays: wd, shiftHoursPerDay: Math.round(sm / 60 * 10) / 10, expectedHours: Math.round(expM / 60 * 10) / 10, actualHours: Math.round(actM / 60 * 10) / 10, achievementPct: expM > 0 ? Math.round(actM / expM * 1000) / 10 : 0, presentDays: a?.days ?? 0 }; });
  h.set('my_billable_target', async (p, e) => { const s = await ttRepo.getSummary({ email: e, startDate: p.startDate as string, endDate: p.endDate as string }); const projs = await db.all<{ budget_hours: number | null; [key: string]: unknown }>('SELECT p.budget_hours FROM time_entries t JOIN projects p ON t.project_id = p.id WHERE t.email = ? AND t.date >= ? AND t.date <= ? AND p.budget_hours IS NOT NULL GROUP BY p.id', [e, p.startDate, p.endDate]); const budget = projs.reduce((acc, r) => acc + (r.budget_hours ?? 0), 0); return { startDate: p.startDate, endDate: p.endDate, billableHours: s.billableHours, nonBillableHours: s.nonBillableHours, totalHours: s.totalHours, budgetHours: budget, utilizationPct: s.totalHours > 0 ? Math.round(s.billableHours / s.totalHours * 1000) / 10 : 0 }; });
  h.set('my_ot_cap_status', async (_p, e) => h.get('my_ot_remaining_quarter')!({}, e));

  // HOLIDAYS
  h.set('is_today_holiday', async () => { const r = await db.get("SELECT * FROM holidays WHERE date = ? AND active = 1 AND type = 'mandatory'", [today()]); return r ? { isHoliday: true, holiday: r } : { isHoliday: false }; });
  h.set('upcoming_holidays', async () => db.all('SELECT * FROM holidays WHERE date >= ? AND active = 1 ORDER BY date LIMIT 10', [today()]));
  h.set('holidays_in_range', async (p) => db.all('SELECT * FROM holidays WHERE date >= ? AND date <= ? AND active = 1 ORDER BY date', [p.startDate, p.endDate]));
  h.set('my_selected_holidays', async (_p, e) => db.all('SELECT h.* FROM holidays h JOIN employee_holiday_selections ehs ON ehs.holiday_id = h.id WHERE ehs.email = ? AND h.active = 1 ORDER BY h.date', [e]));

  // MEETINGS / BD
  h.set('my_tracked_meetings', async (p, e) => { const c = ['ma.email = ?']; const pr: unknown[] = [e]; if (p.startDate) { c.push('ma.session_date >= ?'); pr.push(p.startDate); } if (p.endDate) { c.push('ma.session_date <= ?'); pr.push(p.endDate); } return db.all(`SELECT ma.*, tm.name as meeting_name, tm.platform FROM meeting_attendance ma JOIN tracked_meetings tm ON ma.meeting_id = tm.id WHERE ${c.join(' AND ')} ORDER BY ma.session_date DESC`, pr); });
  h.set('log_meeting', async (p, e) => { const id = uuidv4(); const aid = uuidv4(); const n = await getName(e); await db.run('INSERT INTO tracked_meetings (id, name, platform, added_by) VALUES (?, ?, ?, ?)', [id, p.title, p.platform || 'manual', e]); await db.run('INSERT INTO meeting_attendance (id, meeting_id, session_date, email, display_name, total_seconds, credit) VALUES (?, ?, ?, ?, ?, ?, 100)', [aid, id, p.date, e, n, Math.round((p.hours as number) * 3600)]); return { success: true, meetingId: id }; });
  h.set('submit_bd_meeting', async (p, e) => { const n = await getName(e); return bdService.submit({ email: e, name: n, client: (p.client as string) || (p.title as string) || '', date: p.date as string, time: '', location: '', notes: (p.description as string) || '' }); });
  h.set('my_bd_meetings', async (_p, e) => db.all('SELECT * FROM bd_meetings WHERE email = ? ORDER BY created_at DESC', [e]));

  // MY PENDING
  h.set('my_pending_actions', async () => settingsService.getPendingCounts());

  // ADMIN ATTENDANCE
  h.set('who_is_present_today', async () => db.all("SELECT email, name, total_worked_minutes, first_in FROM attendance_daily WHERE date = ? AND status IN ('in', 'out', 'break') ORDER BY name", [today()]));
  h.set('who_is_absent_today', async () => db.all("SELECT email, name FROM attendance_daily WHERE date = ? AND status = 'absent' ORDER BY name", [today()]));
  h.set('who_is_late_today', async () => db.all('SELECT email, name, late_minutes FROM attendance_daily WHERE date = ? AND is_late = 1 ORDER BY late_minutes DESC', [today()]));
  h.set('who_is_on_leave_today', async () => db.all("SELECT person_email as email, person_name as name, leave_type FROM leave_requests WHERE status = 'Approved' AND start_date <= ? AND end_date >= ? ORDER BY person_name", [today(), today()]));
  h.set('who_is_on_break_today', async () => db.all("SELECT email, name, last_break_start FROM attendance_daily WHERE date = ? AND status = 'break' ORDER BY name", [today()]));
  h.set('attendance_for_date', async (p) => db.all('SELECT * FROM attendance_daily WHERE date = ? ORDER BY name', [p.date]));
  h.set('attendance_for_employee', async (p) => db.all('SELECT * FROM attendance_daily WHERE email = ? AND date >= ? AND date <= ? ORDER BY date', [p.email, p.startDate, p.endDate]));
  h.set('attendance_for_employee_range', async (p) => h.get('attendance_for_employee')!(p, ''));
  h.set('department_attendance', async (p) => { const d = (p.date as string) || today(); return db.all('SELECT ad.* FROM attendance_daily ad JOIN members m ON ad.email = m.email WHERE m.group_id = ? AND ad.date = ? ORDER BY ad.name', [p.groupId, d]); });

  // ADMIN LEAVES
  h.set('pending_leave_approvals', async () => db.all("SELECT * FROM leave_requests WHERE status IN ('Pending', 'Approved by Manager') ORDER BY created_at"));
  h.set('approve_leave', async (p, caller) => { const lv = await db.get<{ status: string; [key: string]: unknown }>('SELECT status FROM leave_requests WHERE id = ?', [p.id]); const a = (p.approverEmail as string) || caller; if (lv?.status === 'Approved by Manager') return leaveService.hrApprove(p.id as string, a); return leaveService.managerApprove(p.id as string, a); });
  h.set('reject_leave', async (p, caller) => leaveService.reject(p.id as string, (p.approverEmail as string) || caller, p.reason as string));
  h.set('leave_report', async (p) => analyticsService.getLeaveReport({ startDate: p.startDate as string, endDate: p.endDate as string, groupId: p.groupId as string | undefined }));
  h.set('leaves_for_employee', async (p) => db.all('SELECT * FROM leave_requests WHERE person_email = ? ORDER BY created_at DESC', [p.email]));

  // ADMIN REGULARIZATION
  h.set('pending_regularizations', async () => db.all("SELECT * FROM regularizations WHERE status = 'pending' ORDER BY created_at"));
  h.set('approve_regularization', async (p, caller) => regService.approve(String(p.id), 'manager', (p.approverEmail as string) || caller));
  h.set('reject_regularization', async (p, caller) => regService.reject(String(p.id), (p.approverEmail as string) || caller, p.reason as string));
  h.set('regularizations_for_employee', async (p) => db.all('SELECT * FROM regularizations WHERE email = ? ORDER BY created_at DESC', [p.email]));

  // ADMIN OVERTIME
  h.set('pending_overtime_approvals', async () => otService.getPending());
  h.set('approve_overtime', async (p, caller) => otService.approve(Number(p.id), (p.approverEmail as string) || caller));
  h.set('reject_overtime', async (p, caller) => otService.reject(Number(p.id), (p.approverEmail as string) || caller, (p.reason as string) || ''));
  h.set('overtime_report', async (p) => analyticsService.getOvertimeReport({ startDate: p.startDate as string, endDate: p.endDate as string, groupId: p.groupId as string | undefined, email: p.email as string | undefined }));

  // ADMIN BD
  h.set('pending_bd_meetings', async () => db.all("SELECT * FROM bd_meetings WHERE status IN ('pending', 'qualified') ORDER BY created_at"));
  h.set('approve_bd_meeting', async (p, caller) => bdService.approve(String(p.id), (p.approverEmail as string) || caller));
  h.set('reject_bd_meeting', async (p, caller) => bdService.reject(String(p.id), (p.approverEmail as string) || caller, (p.reason as string) || ''));

  // ADMIN TIMESHEETS
  h.set('pending_timesheets', async () => tsService.list({ status: 'submitted' }));
  h.set('approve_timesheet', async (p, caller) => tsService.approve(p.id as string, (p.approverEmail as string) || caller));
  h.set('reject_timesheet', async (p, caller) => tsService.reject(p.id as string, (p.approverEmail as string) || caller, (p.reason as string) || ''));
  h.set('timesheets_for_employee', async (p) => tsService.list({ email: p.email as string }));

  // ADMIN TARGETS
  h.set('employee_attendance_target', async (p) => h.get('my_attendance_target')!(p, p.email as string));
  h.set('group_attendance_target', async (p) => { const members = await db.all<{ email: string; [key: string]: unknown }>('SELECT email FROM members WHERE group_id = ? AND active = 1', [p.groupId]); const res = []; for (const m of members) res.push({ email: m.email, ...(await h.get('my_attendance_target')!({ startDate: p.startDate, endDate: p.endDate }, m.email) as object) }); return res; });
  h.set('employee_billable_target', async (p) => h.get('my_billable_target')!(p, p.email as string));

  // ADMIN PEOPLE
  h.set('employee_info', async (p) => db.get('SELECT email, name, designation, group_id, member_type_id, role, phone, joining_date, location, timezone, active FROM members WHERE email = ?', [p.email]));
  h.set('employee_count', async (p) => { const c = ['active = 1']; const pr: unknown[] = []; if (p.groupId) { c.push('group_id = ?'); pr.push(p.groupId); } const r = await db.get<{ cnt: number; [key: string]: unknown }>(`SELECT COUNT(*) as cnt FROM members WHERE ${c.join(' AND ')}`, pr); return { count: r?.cnt ?? 0, groupId: p.groupId || 'all' }; });
  h.set('employee_list_department', async (p) => db.all('SELECT email, name, designation, role FROM members WHERE group_id = ? AND active = 1 ORDER BY name', [p.groupId]));
  h.set('employee_of_month', async () => settingsService.getEmployeeOfMonth());

  // ADMIN REPORTS
  h.set('department_dashboard', async (p) => analyticsService.getDepartmentDashboard(today(), p.startDate as string | undefined, p.endDate as string | undefined));
  h.set('utilization_report', async (p) => analyticsService.getUtilization({ startDate: p.startDate as string, endDate: p.endDate as string, email: p.email as string | undefined }));
  h.set('attendance_trend', async (p) => analyticsService.getAttendanceTrend({ startDate: p.startDate as string, endDate: p.endDate as string, groupId: p.groupId as string | undefined, groupBy: (p.groupBy as 'day' | 'week' | 'month') || 'day' }));
  h.set('attendance_overview', async (p) => analyticsService.getAttendanceOverview({ startDate: p.startDate as string, endDate: p.endDate as string, groupId: p.groupId as string | undefined, email: p.email as string | undefined }));

  // ALL PENDING
  h.set('all_pending_approvals', async () => { const [lv, rg, ot, bd, ts] = await Promise.all([ db.get<{ cnt: number; [key: string]: unknown }>("SELECT COUNT(*) as cnt FROM leave_requests WHERE status IN ('Pending', 'Approved by Manager')", []), db.get<{ cnt: number; [key: string]: unknown }>("SELECT COUNT(*) as cnt FROM regularizations WHERE status = 'pending'", []), db.get<{ cnt: number; [key: string]: unknown }>("SELECT COUNT(*) as cnt FROM overtime_records WHERE status = 'pending'", []), db.get<{ cnt: number; [key: string]: unknown }>("SELECT COUNT(*) as cnt FROM bd_meetings WHERE status IN ('pending', 'qualified')", []), db.get<{ cnt: number; [key: string]: unknown }>("SELECT COUNT(*) as cnt FROM timesheets WHERE status = 'submitted'", []) ]); return { pendingLeaves: lv?.cnt ?? 0, pendingRegularizations: rg?.cnt ?? 0, pendingOvertime: ot?.cnt ?? 0, pendingBdMeetings: bd?.cnt ?? 0, pendingTimesheets: ts?.cnt ?? 0, total: (lv?.cnt ?? 0) + (rg?.cnt ?? 0) + (ot?.cnt ?? 0) + (bd?.cnt ?? 0) + (ts?.cnt ?? 0) }; });

  return h;
}
