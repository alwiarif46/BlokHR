import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { TimetableRepository } from '../repositories/timetable-repository';
import { generateInstances } from './instance-generator';
import type {
  Allocation,
  CoverAssignment,
  CoverFairnessRow,
  CreateAbsenceInput,
  CreateAllocationInput,
  CreateDaySchemeInput,
  CreateExclusionInput,
  CreateSectionInput,
  CreateSubjectInput,
  CreateTermInput,
  DayScheme,
  DaySchemeKind,
  Exclusion,
  ExclusionReason,
  ExclusionScope,
  GenerateInstancesResult,
  ListExclusionsQuery,
  ListPeriodInstancesQuery,
  PatchAllocationInput,
  PatchDaySchemeInput,
  PatchExclusionInput,
  PatchPeriodInstanceInput,
  PatchSectionInput,
  PatchSubjectInput,
  PatchTermInput,
  PeriodDef,
  PeriodInstance,
  PeriodInstanceStatus,
  PeriodLostReason,
  Section,
  Slot,
  SlotGridEntry,
  SlotInput,
  Subject,
  TeacherAbsence,
  TeacherClash,
  Term,
} from '../types';

type ServiceError = { error: string; status: number; clashes?: TeacherClash[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = new Set<DaySchemeKind>(['weekly', 'cyclic']);
const SCOPES = new Set<ExclusionScope>(['school', 'class']);
const REASONS = new Set<ExclusionReason>(['holiday', 'exam', 'event', 'other']);
const WEEKDAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const INSTANCE_STATUSES = new Set<PeriodInstanceStatus>(['scheduled', 'held', 'lost']);
const LOST_REASONS = new Set<PeriodLostReason>([
  'holiday',
  'exam',
  'event',
  'teacher_absent_uncovered',
  'other',
]);

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export class TimetableService {
  constructor(
    private readonly repo: TimetableRepository,
    private readonly events: EventPublisher,
  ) {}

  async listTerms(tenantId: string): Promise<Term[]> {
    return this.repo.listTerms(tenantId);
  }

  async getTerm(tenantId: string, id: string): Promise<Term | null> {
    return this.repo.getTerm(tenantId, id);
  }

  async createTerm(
    tenantId: string,
    input: CreateTermInput,
  ): Promise<{ term?: Term; error?: ServiceError }> {
    const validated = this.validateTerm(input);
    if ('error' in validated) return { error: validated };
    const term = await this.repo.insertTerm({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { term };
  }

  async patchTerm(
    tenantId: string,
    id: string,
    input: PatchTermInput,
  ): Promise<{ term?: Term; error?: ServiceError }> {
    const existing = await this.repo.getTerm(tenantId, id);
    if (!existing) return { error: { error: 'Term not found', status: 404 } };
    const merged: CreateTermInput = {
      academicSessionId: input.academicSessionId ?? existing.academicSessionId,
      label: input.label ?? existing.label,
      startsOn: input.startsOn ?? existing.startsOn,
      endsOn: input.endsOn ?? existing.endsOn,
    };
    const validated = this.validateTerm(merged);
    if ('error' in validated) return { error: validated };
    const term = await this.repo.updateTerm(tenantId, id, {
      ...existing,
      ...validated,
    });
    if (!term) return { error: { error: 'Term not found', status: 404 } };
    return { term };
  }

  async deleteTerm(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const ok = await this.repo.deleteTerm(tenantId, id);
    if (!ok) return { error: { error: 'Term not found', status: 404 } };
    return { ok: true };
  }

  async listDaySchemes(tenantId: string): Promise<DayScheme[]> {
    return this.repo.listDaySchemes(tenantId);
  }

  async getDayScheme(tenantId: string, id: string): Promise<DayScheme | null> {
    return this.repo.getDayScheme(tenantId, id);
  }

  async createDayScheme(
    tenantId: string,
    input: CreateDaySchemeInput,
  ): Promise<{ dayScheme?: DayScheme; error?: ServiceError }> {
    const validated = this.validateDayScheme(input);
    if ('error' in validated) return { error: validated };
    const dayScheme = await this.repo.insertDayScheme({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { dayScheme };
  }

  async patchDayScheme(
    tenantId: string,
    id: string,
    input: PatchDaySchemeInput,
  ): Promise<{ dayScheme?: DayScheme; error?: ServiceError }> {
    const existing = await this.repo.getDayScheme(tenantId, id);
    if (!existing) return { error: { error: 'Day scheme not found', status: 404 } };
    const merged: CreateDaySchemeInput = {
      label: input.label ?? existing.label,
      kind: input.kind ?? existing.kind,
      cycleLength:
        input.cycleLength !== undefined ? input.cycleLength : existing.cycleLength,
      periods: input.periods ?? existing.periods,
    };
    const validated = this.validateDayScheme(merged);
    if ('error' in validated) return { error: validated };
    const dayScheme = await this.repo.updateDayScheme(tenantId, id, {
      ...existing,
      ...validated,
    });
    if (!dayScheme) return { error: { error: 'Day scheme not found', status: 404 } };
    return { dayScheme };
  }

  async deleteDayScheme(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const ok = await this.repo.deleteDayScheme(tenantId, id);
    if (!ok) return { error: { error: 'Day scheme not found', status: 404 } };
    return { ok: true };
  }

  async listExclusions(
    tenantId: string,
    query: ListExclusionsQuery,
  ): Promise<{ exclusions?: Exclusion[]; error?: ServiceError }> {
    if (query.from && !ISO_DATE.test(query.from)) {
      return { error: { error: 'from must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (query.to && !ISO_DATE.test(query.to)) {
      return { error: { error: 'to must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    const exclusions = await this.repo.listExclusions(tenantId, {
      from: query.from,
      to: query.to,
    });
    return { exclusions };
  }

  async getExclusion(tenantId: string, id: string): Promise<Exclusion | null> {
    return this.repo.getExclusion(tenantId, id);
  }

  async createExclusion(
    tenantId: string,
    input: CreateExclusionInput,
  ): Promise<{ exclusion?: Exclusion; error?: ServiceError }> {
    const validated = this.validateExclusion(input);
    if ('error' in validated) return { error: validated };
    const exclusion = await this.repo.insertExclusion({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { exclusion };
  }

  async patchExclusion(
    tenantId: string,
    id: string,
    input: PatchExclusionInput,
  ): Promise<{ exclusion?: Exclusion; error?: ServiceError }> {
    const existing = await this.repo.getExclusion(tenantId, id);
    if (!existing) return { error: { error: 'Exclusion not found', status: 404 } };
    const merged: CreateExclusionInput = {
      date: input.date ?? existing.date,
      scope: input.scope ?? existing.scope,
      classLabel: input.classLabel !== undefined ? input.classLabel : existing.classLabel,
      reason: input.reason ?? existing.reason,
      label: input.label ?? existing.label,
    };
    const validated = this.validateExclusion(merged);
    if ('error' in validated) return { error: validated };
    const exclusion = await this.repo.updateExclusion(tenantId, id, {
      ...existing,
      ...validated,
    });
    if (!exclusion) return { error: { error: 'Exclusion not found', status: 404 } };
    return { exclusion };
  }

  async deleteExclusion(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const ok = await this.repo.deleteExclusion(tenantId, id);
    if (!ok) return { error: { error: 'Exclusion not found', status: 404 } };
    return { ok: true };
  }

  private validateTerm(
    input: CreateTermInput,
  ):
    | Omit<Term, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const academicSessionId = (input.academicSessionId || '').trim();
    const label = (input.label || '').trim();
    if (!academicSessionId) return { error: 'academic_session_id is required', status: 400 };
    if (!label) return { error: 'label is required', status: 400 };

    const startsOn = (input.startsOn || '').trim();
    const endsOn = (input.endsOn || '').trim();
    if (!ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) {
      return { error: 'starts_on and ends_on must be ISO dates (YYYY-MM-DD)', status: 400 };
    }
    if (endsOn < startsOn) {
      return { error: 'ends_on must be on or after starts_on', status: 400 };
    }

    return { academicSessionId, label, startsOn, endsOn };
  }

  private validateDayScheme(
    input: CreateDaySchemeInput,
  ):
    | Omit<DayScheme, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const label = (input.label || '').trim();
    if (!label) return { error: 'label is required', status: 400 };
    if (!KINDS.has(input.kind)) return { error: 'kind must be weekly or cyclic', status: 400 };

    let cycleLength: number | null = null;
    if (input.kind === 'cyclic') {
      const n = Number(input.cycleLength);
      if (!Number.isInteger(n) || n < 2) {
        return { error: 'cycle_length must be an integer >= 2 for cyclic schemes', status: 400 };
      }
      cycleLength = n;
    } else if (input.cycleLength != null && input.cycleLength !== undefined) {
      return { error: 'cycle_length is only allowed for cyclic schemes', status: 400 };
    }

    const periodsErr = this.validatePeriods(input.periods);
    if (periodsErr) return periodsErr;

    return {
      label,
      kind: input.kind,
      cycleLength,
      periods: [...input.periods].sort((a, b) => a.index - b.index),
    };
  }

  validatePeriods(periods: PeriodDef[] | undefined): ServiceError | null {
    if (!Array.isArray(periods) || periods.length === 0) {
      return { error: 'periods must be a non-empty array', status: 400 };
    }

    const normalized: PeriodDef[] = [];
    for (const p of periods) {
      const index = Number(p.index);
      const label = String(p.label ?? '').trim();
      const startTime = String(p.startTime ?? '').trim();
      const endTime = String(p.endTime ?? '').trim();
      const isTeaching = !!p.isTeaching;
      if (!Number.isInteger(index) || index < 0) {
        return { error: 'period index must be a non-negative integer', status: 400 };
      }
      if (!label) return { error: 'period label is required', status: 400 };
      if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
        return { error: 'period times must be HH:MM (24h)', status: 400 };
      }
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        return { error: 'period end_time must be after start_time', status: 400 };
      }
      normalized.push({ index, label, startTime, endTime, isTeaching });
    }

    const sorted = [...normalized].sort((a, b) => a.index - b.index);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].index !== sorted[i - 1].index + 1) {
        return { error: 'period indexes must be contiguous and ordered', status: 400 };
      }
    }

    for (let i = 1; i < sorted.length; i++) {
      if (timeToMinutes(sorted[i].startTime) < timeToMinutes(sorted[i - 1].endTime)) {
        return { error: 'periods must not overlap', status: 400 };
      }
    }

    if (!sorted.some((p) => p.isTeaching)) {
      return { error: 'at least one teaching period is required', status: 400 };
    }

    return null;
  }

  private validateExclusion(
    input: CreateExclusionInput,
  ):
    | Omit<Exclusion, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const date = (input.date || '').trim();
    if (!ISO_DATE.test(date)) return { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 };
    if (!SCOPES.has(input.scope)) return { error: 'scope must be school or class', status: 400 };
    if (!REASONS.has(input.reason)) {
      return { error: 'reason must be holiday, exam, event, or other', status: 400 };
    }
    const label = (input.label || '').trim();
    if (!label) return { error: 'label is required', status: 400 };

    let classLabel: string | null = null;
    if (input.scope === 'class') {
      classLabel = (input.classLabel || '').trim();
      if (!classLabel) {
        return { error: 'class_label is required for class-scoped exclusions', status: 400 };
      }
    } else if (input.classLabel != null && String(input.classLabel).trim() !== '') {
      return { error: 'class_label is only allowed for class-scoped exclusions', status: 400 };
    }

    return { date, scope: input.scope, classLabel, reason: input.reason, label };
  }

  async listSections(tenantId: string): Promise<Section[]> {
    return this.repo.listSections(tenantId);
  }

  async getSection(tenantId: string, id: string): Promise<Section | null> {
    return this.repo.getSection(tenantId, id);
  }

  async createSection(
    tenantId: string,
    input: CreateSectionInput,
  ): Promise<{ section?: Section; error?: ServiceError }> {
    const validated = this.validateSection(input);
    if ('error' in validated) return { error: validated };

    const scheme = await this.repo.getDayScheme(tenantId, validated.daySchemeId);
    if (!scheme) return { error: { error: 'day_scheme not found', status: 404 } };

    const dup = await this.repo.findSectionByKey(
      tenantId,
      validated.academicSessionId,
      validated.classLabel,
      validated.section,
    );
    if (dup) {
      return { error: { error: 'section already exists for session/class', status: 409 } };
    }

    const section = await this.repo.insertSection({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { section };
  }

  async patchSection(
    tenantId: string,
    id: string,
    input: PatchSectionInput,
  ): Promise<{ section?: Section; error?: ServiceError }> {
    const existing = await this.repo.getSection(tenantId, id);
    if (!existing) return { error: { error: 'Section not found', status: 404 } };

    const merged: CreateSectionInput = {
      academicSessionId: input.academicSessionId ?? existing.academicSessionId,
      classLabel: input.classLabel ?? existing.classLabel,
      section: input.section ?? existing.section,
      daySchemeId: input.daySchemeId ?? existing.daySchemeId,
      classTeacherMemberId:
        input.classTeacherMemberId !== undefined
          ? input.classTeacherMemberId
          : existing.classTeacherMemberId,
    };
    const validated = this.validateSection(merged);
    if ('error' in validated) return { error: validated };

    const scheme = await this.repo.getDayScheme(tenantId, validated.daySchemeId);
    if (!scheme) return { error: { error: 'day_scheme not found', status: 404 } };

    const dup = await this.repo.findSectionByKey(
      tenantId,
      validated.academicSessionId,
      validated.classLabel,
      validated.section,
    );
    if (dup && dup.id !== id) {
      return { error: { error: 'section already exists for session/class', status: 409 } };
    }

    const section = await this.repo.updateSection(tenantId, id, { ...existing, ...validated });
    if (!section) return { error: { error: 'Section not found', status: 404 } };
    return { section };
  }

  async deleteSection(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const existing = await this.repo.getSection(tenantId, id);
    if (!existing) return { error: { error: 'Section not found', status: 404 } };
    const allocCount = await this.repo.countAllocationsForSection(tenantId, id);
    if (allocCount > 0) {
      return { error: { error: 'section has allocations', status: 409 } };
    }
    await this.repo.deleteSection(tenantId, id);
    return { ok: true };
  }

  async listSubjects(tenantId: string): Promise<Subject[]> {
    return this.repo.listSubjects(tenantId);
  }

  async getSubject(tenantId: string, id: string): Promise<Subject | null> {
    return this.repo.getSubject(tenantId, id);
  }

  async createSubject(
    tenantId: string,
    input: CreateSubjectInput,
  ): Promise<{ subject?: Subject; error?: ServiceError }> {
    const validated = this.validateSubject(input);
    if ('error' in validated) return { error: validated };

    const dup = await this.repo.findSubjectByCode(tenantId, validated.code);
    if (dup) return { error: { error: 'subject code already exists', status: 409 } };

    const subject = await this.repo.insertSubject({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { subject };
  }

  async patchSubject(
    tenantId: string,
    id: string,
    input: PatchSubjectInput,
  ): Promise<{ subject?: Subject; error?: ServiceError }> {
    const existing = await this.repo.getSubject(tenantId, id);
    if (!existing) return { error: { error: 'Subject not found', status: 404 } };

    const merged: CreateSubjectInput = {
      code: input.code ?? existing.code,
      label: input.label ?? existing.label,
      isElective: input.isElective !== undefined ? input.isElective : existing.isElective,
    };
    const validated = this.validateSubject(merged);
    if ('error' in validated) return { error: validated };

    const dup = await this.repo.findSubjectByCode(tenantId, validated.code);
    if (dup && dup.id !== id) {
      return { error: { error: 'subject code already exists', status: 409 } };
    }

    const subject = await this.repo.updateSubject(tenantId, id, { ...existing, ...validated });
    if (!subject) return { error: { error: 'Subject not found', status: 404 } };
    return { subject };
  }

  async deleteSubject(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const existing = await this.repo.getSubject(tenantId, id);
    if (!existing) return { error: { error: 'Subject not found', status: 404 } };
    const allocCount = await this.repo.countAllocationsForSubject(tenantId, id);
    if (allocCount > 0) {
      return { error: { error: 'subject has allocations', status: 409 } };
    }
    await this.repo.deleteSubject(tenantId, id);
    return { ok: true };
  }

  async listAllocations(tenantId: string): Promise<Allocation[]> {
    return this.repo.listAllocations(tenantId);
  }

  async getAllocation(tenantId: string, id: string): Promise<Allocation | null> {
    return this.repo.getAllocation(tenantId, id);
  }

  async createAllocation(
    tenantId: string,
    input: CreateAllocationInput,
  ): Promise<{ allocation?: Allocation; error?: ServiceError }> {
    const validated = this.validateAllocation(input);
    if ('error' in validated) return { error: validated };

    const section = await this.repo.getSection(tenantId, validated.sectionId);
    if (!section) return { error: { error: 'section not found', status: 404 } };
    const subject = await this.repo.getSubject(tenantId, validated.subjectId);
    if (!subject) return { error: { error: 'subject not found', status: 404 } };

    const dup = await this.repo.findAllocationBySectionSubject(
      tenantId,
      validated.sectionId,
      validated.subjectId,
    );
    if (dup) {
      return { error: { error: 'allocation already exists for section/subject', status: 409 } };
    }

    const allocation = await this.repo.insertAllocation({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { allocation };
  }

  async patchAllocation(
    tenantId: string,
    id: string,
    input: PatchAllocationInput,
  ): Promise<{ allocation?: Allocation; error?: ServiceError }> {
    const existing = await this.repo.getAllocation(tenantId, id);
    if (!existing) return { error: { error: 'Allocation not found', status: 404 } };

    const merged: CreateAllocationInput = {
      sectionId: input.sectionId ?? existing.sectionId,
      subjectId: input.subjectId ?? existing.subjectId,
      teacherMemberId: input.teacherMemberId ?? existing.teacherMemberId,
      periodsPerWeek:
        input.periodsPerWeek !== undefined ? input.periodsPerWeek : existing.periodsPerWeek,
      room: input.room !== undefined ? input.room : existing.room,
    };
    const validated = this.validateAllocation(merged);
    if ('error' in validated) return { error: validated };

    const section = await this.repo.getSection(tenantId, validated.sectionId);
    if (!section) return { error: { error: 'section not found', status: 404 } };
    const subject = await this.repo.getSubject(tenantId, validated.subjectId);
    if (!subject) return { error: { error: 'subject not found', status: 404 } };

    const dup = await this.repo.findAllocationBySectionSubject(
      tenantId,
      validated.sectionId,
      validated.subjectId,
    );
    if (dup && dup.id !== id) {
      return { error: { error: 'allocation already exists for section/subject', status: 409 } };
    }

    const allocation = await this.repo.updateAllocation(tenantId, id, {
      ...existing,
      ...validated,
    });
    if (!allocation) return { error: { error: 'Allocation not found', status: 404 } };
    return { allocation };
  }

  async deleteAllocation(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const ok = await this.repo.deleteAllocation(tenantId, id);
    if (!ok) return { error: { error: 'Allocation not found', status: 404 } };
    return { ok: true };
  }

  private validateSection(
    input: CreateSectionInput,
  ):
    | Omit<Section, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const academicSessionId = (input.academicSessionId || '').trim();
    const classLabel = (input.classLabel || '').trim();
    const section = (input.section || '').trim();
    const daySchemeId = (input.daySchemeId || '').trim();
    if (!academicSessionId) return { error: 'academic_session_id is required', status: 400 };
    if (!classLabel) return { error: 'class_label is required', status: 400 };
    if (!section) return { error: 'section is required', status: 400 };
    if (!daySchemeId) return { error: 'day_scheme_id is required', status: 400 };

    const classTeacherMemberId =
      input.classTeacherMemberId != null && String(input.classTeacherMemberId).trim() !== ''
        ? String(input.classTeacherMemberId).trim()
        : null;

    return {
      academicSessionId,
      classLabel,
      section,
      daySchemeId,
      classTeacherMemberId,
    };
  }

  private validateSubject(
    input: CreateSubjectInput,
  ):
    | Omit<Subject, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const code = (input.code || '').trim();
    const label = (input.label || '').trim();
    if (!code) return { error: 'code is required', status: 400 };
    if (!label) return { error: 'label is required', status: 400 };
    return { code, label, isElective: !!input.isElective };
  }

  private validateAllocation(
    input: CreateAllocationInput,
  ):
    | Omit<Allocation, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const sectionId = (input.sectionId || '').trim();
    const subjectId = (input.subjectId || '').trim();
    const teacherMemberId = (input.teacherMemberId || '').trim();
    if (!sectionId) return { error: 'section_id is required', status: 400 };
    if (!subjectId) return { error: 'subject_id is required', status: 400 };
    if (!teacherMemberId) return { error: 'teacher_member_id is required', status: 400 };

    const periodsPerWeek = Number(input.periodsPerWeek);
    if (!Number.isInteger(periodsPerWeek) || periodsPerWeek < 1) {
      return { error: 'periods_per_week must be an integer >= 1', status: 400 };
    }

    const room =
      input.room != null && String(input.room).trim() !== '' ? String(input.room).trim() : null;

    return { sectionId, subjectId, teacherMemberId, periodsPerWeek, room };
  }

  async getSectionSlots(
    tenantId: string,
    sectionId: string,
  ): Promise<{ slots?: SlotGridEntry[]; error?: ServiceError }> {
    const section = await this.repo.getSection(tenantId, sectionId);
    if (!section) return { error: { error: 'Section not found', status: 404 } };
    const slots = await this.repo.listSlotGridForSection(tenantId, sectionId);
    return { slots };
  }

  async getTeacherSlots(
    tenantId: string,
    memberId: string,
  ): Promise<{ slots: SlotGridEntry[] }> {
    const slots = await this.repo.listSlotGridForTeacher(tenantId, memberId.trim());
    return { slots };
  }

  async replaceSectionSlots(
    tenantId: string,
    sectionId: string,
    inputs: SlotInput[],
  ): Promise<{ slots?: SlotGridEntry[]; error?: ServiceError }> {
    const section = await this.repo.getSection(tenantId, sectionId);
    if (!section) return { error: { error: 'Section not found', status: 404 } };

    const scheme = await this.repo.getDayScheme(tenantId, section.daySchemeId);
    if (!scheme) return { error: { error: 'day_scheme not found', status: 404 } };

    if (!Array.isArray(inputs)) {
      return { error: { error: 'body must be an array of slots', status: 400 } };
    }

    const legalDays = this.legalDayRefs(scheme);
    const teachingIndexes = new Set(
      scheme.periods.filter((p) => p.isTeaching).map((p) => p.index),
    );
    const seenCells = new Set<string>();
    const normalized: Array<SlotInput & { teacherMemberId: string }> = [];

    for (const raw of inputs) {
      const dayRef = String(raw.dayRef ?? '').trim().toLowerCase();
      const periodIndex = Number(raw.periodIndex);
      const allocationId = String(raw.allocationId ?? '').trim();

      if (!legalDays.has(dayRef)) {
        return { error: { error: `invalid day_ref for scheme: ${dayRef || '(empty)'}`, status: 400 } };
      }
      if (!Number.isInteger(periodIndex)) {
        return { error: { error: 'period_index must be an integer', status: 400 } };
      }
      if (!teachingIndexes.has(periodIndex)) {
        return {
          error: { error: `period_index ${periodIndex} is not a teaching period`, status: 400 },
        };
      }
      if (!allocationId) {
        return { error: { error: 'allocation_id is required', status: 400 } };
      }

      const cellKey = `${dayRef}:${periodIndex}`;
      if (seenCells.has(cellKey)) {
        return {
          error: { error: `duplicate slot for ${dayRef} period ${periodIndex}`, status: 400 },
        };
      }
      seenCells.add(cellKey);

      const allocation = await this.repo.getAllocation(tenantId, allocationId);
      if (!allocation || allocation.sectionId !== sectionId) {
        return {
          error: { error: 'allocation must belong to the section', status: 400 },
        };
      }

      normalized.push({
        dayRef,
        periodIndex,
        allocationId,
        teacherMemberId: allocation.teacherMemberId,
      });
    }

    const otherSlots = await this.repo.listSlotsForSessionExcludingSection(
      tenantId,
      section.academicSessionId,
      sectionId,
    );
    const otherIndex = new Map<string, (typeof otherSlots)[0]>();
    for (const slot of otherSlots) {
      otherIndex.set(
        `${slot.teacherMemberId}|${slot.dayRef}|${slot.periodIndex}`,
        slot,
      );
    }

    const clashes: TeacherClash[] = [];
    for (const slot of normalized) {
      const hit = otherIndex.get(
        `${slot.teacherMemberId}|${slot.dayRef}|${slot.periodIndex}`,
      );
      if (hit) {
        clashes.push({
          sectionId,
          dayRef: slot.dayRef,
          periodIndex: slot.periodIndex,
          teacherMemberId: slot.teacherMemberId,
          allocationId: slot.allocationId,
          conflictingSectionId: hit.sectionId,
        });
      }
    }
    if (clashes.length > 0) {
      return {
        error: { error: 'teacher clash', status: 409, clashes },
      };
    }

    const toInsert: Slot[] = normalized.map((s) => ({
      id: uuidv4(),
      tenantId,
      sectionId,
      dayRef: s.dayRef,
      periodIndex: s.periodIndex,
      allocationId: s.allocationId,
      createdAt: '',
    }));
    await this.repo.replaceSectionSlots(tenantId, sectionId, toInsert);
    const slots = await this.repo.listSlotGridForSection(tenantId, sectionId);
    return { slots };
  }

  private legalDayRefs(scheme: DayScheme): Set<string> {
    if (scheme.kind === 'weekly') {
      return new Set(WEEKDAYS);
    }
    const n = scheme.cycleLength ?? 0;
    const refs = new Set<string>();
    for (let i = 1; i <= n; i++) refs.add(`d${i}`);
    return refs;
  }

  async generateSectionInstances(
    tenantId: string,
    sectionId: string,
    from: string,
    to: string,
  ): Promise<{ result?: GenerateInstancesResult; error?: ServiceError }> {
    const fromDate = (from || '').trim();
    const toDate = (to || '').trim();
    if (!ISO_DATE.test(fromDate) || !ISO_DATE.test(toDate)) {
      return { error: { error: 'from and to must be ISO dates (YYYY-MM-DD)', status: 400 } };
    }
    if (toDate < fromDate) {
      return { error: { error: 'to must be on or after from', status: 400 } };
    }
    return generateInstances(this.repo, tenantId, sectionId, fromDate, toDate);
  }

  async listSectionInstances(
    tenantId: string,
    sectionId: string,
    query: ListPeriodInstancesQuery,
  ): Promise<{ instances?: PeriodInstance[]; error?: ServiceError }> {
    const section = await this.repo.getSection(tenantId, sectionId);
    if (!section) return { error: { error: 'Section not found', status: 404 } };
    if (query.from && !ISO_DATE.test(query.from)) {
      return { error: { error: 'from must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (query.to && !ISO_DATE.test(query.to)) {
      return { error: { error: 'to must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (query.status && !INSTANCE_STATUSES.has(query.status)) {
      return { error: { error: 'invalid status', status: 400 } };
    }
    const instances = await this.repo.listPeriodInstances(tenantId, sectionId, {
      from: query.from,
      to: query.to,
      status: query.status,
    });
    return { instances };
  }

  async patchPeriodInstance(
    tenantId: string,
    id: string,
    input: PatchPeriodInstanceInput,
  ): Promise<{ instance?: PeriodInstance; error?: ServiceError }> {
    const existing = await this.repo.getPeriodInstance(tenantId, id);
    if (!existing) return { error: { error: 'Period instance not found', status: 404 } };

    if (existing.status === 'held') {
      return { error: { error: 'held is terminal', status: 409 } };
    }

    const nextStatus = input.status;
    if (!INSTANCE_STATUSES.has(nextStatus)) {
      return { error: { error: 'invalid status', status: 400 } };
    }

    let lostReason: PeriodLostReason | null = existing.lostReason;

    if (existing.status === 'scheduled' && nextStatus === 'held') {
      lostReason = null;
    } else if (existing.status === 'scheduled' && nextStatus === 'lost') {
      const reason = input.lostReason;
      if (!reason || !LOST_REASONS.has(reason)) {
        return { error: { error: 'lost_reason is required when marking lost', status: 400 } };
      }
      lostReason = reason;
    } else if (existing.status === 'lost' && nextStatus === 'scheduled') {
      lostReason = null;
    } else if (existing.status === nextStatus) {
      return { instance: existing };
    } else {
      return {
        error: {
          error: `illegal transition ${existing.status} → ${nextStatus}`,
          status: 409,
        },
      };
    }

    const updated = await this.repo.updatePeriodInstance(tenantId, id, {
      ...existing,
      status: nextStatus,
      lostReason,
    });
    if (!updated) return { error: { error: 'Period instance not found', status: 404 } };

    if (nextStatus === 'lost' && existing.status !== 'lost') {
      await this.events.publish({
        type: 'school.period.lost',
        tenantId,
        occurredAt: new Date().toISOString(),
        data: {
          instanceId: updated.id,
          sectionId: updated.sectionId,
          date: updated.date,
          periodIndex: updated.periodIndex,
          allocationId: updated.allocationId,
          lostReason: updated.lostReason,
        },
      });
    }

    return { instance: updated };
  }

  async createAbsence(
    tenantId: string,
    input: CreateAbsenceInput,
  ): Promise<{
    absence?: TeacherAbsence;
    covers?: CoverAssignment[];
    error?: ServiceError;
  }> {
    const teacherMemberId = (input.teacherMemberId || '').trim();
    const date = (input.date || '').trim();
    const reason = (input.reason || '').trim();
    if (!teacherMemberId) return { error: { error: 'teacher_member_id is required', status: 400 } };
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (!reason) return { error: { error: 'reason is required', status: 400 } };

    let periodIndexes: number[] | null = null;
    if (input.periodIndexes != null) {
      if (!Array.isArray(input.periodIndexes) || input.periodIndexes.length === 0) {
        return { error: { error: 'period_indexes must be a non-empty array when provided', status: 400 } };
      }
      if (!input.periodIndexes.every((n) => Number.isInteger(n) && n >= 0)) {
        return { error: { error: 'period_indexes must be non-negative integers', status: 400 } };
      }
      periodIndexes = input.periodIndexes;
    }

    const absence = await this.repo.insertTeacherAbsence({
      id: uuidv4(),
      tenantId,
      teacherMemberId,
      date,
      periodIndexes,
      reason,
      createdAt: '',
    });

    let instances = await this.repo.listPeriodInstancesForTeacherOnDate(
      tenantId,
      teacherMemberId,
      date,
    );
    instances = instances.filter((i) => i.status === 'scheduled' || i.status === 'held');
    if (periodIndexes) {
      const allowed = new Set(periodIndexes);
      instances = instances.filter((i) => allowed.has(i.periodIndex));
    }

    const covers: CoverAssignment[] = [];
    for (const instance of instances) {
      const cover = await this.repo.insertCoverAssignment({
        id: uuidv4(),
        tenantId,
        absenceId: absence.id,
        periodInstanceId: instance.id,
        coverTeacherMemberId: null,
        state: 'open',
        offeredAt: null,
        respondedAt: null,
        notes: null,
        createdAt: '',
        updatedAt: '',
      });
      covers.push(cover);
      await this.events.publish({
        type: 'school.cover.needed',
        tenantId,
        occurredAt: new Date().toISOString(),
        data: {
          coverId: cover.id,
          absenceId: absence.id,
          sectionId: instance.sectionId,
          subjectId: instance.subjectId,
          subjectCode: instance.subjectCode,
          periodIndex: instance.periodIndex,
          date: instance.date,
        },
      });
    }

    return { absence, covers };
  }

  async offerCover(
    tenantId: string,
    coverId: string,
    coverTeacherMemberId: string,
  ): Promise<{ cover?: CoverAssignment; error?: ServiceError }> {
    const cover = await this.repo.getCoverAssignment(tenantId, coverId);
    if (!cover) return { error: { error: 'Cover assignment not found', status: 404 } };
    if (cover.state !== 'open') {
      return { error: { error: `cannot offer from state ${cover.state}`, status: 409 } };
    }

    const teacherId = (coverTeacherMemberId || '').trim();
    if (!teacherId) {
      return { error: { error: 'cover_teacher_member_id is required', status: 400 } };
    }

    const instance = await this.repo.getPeriodInstance(tenantId, cover.periodInstanceId);
    if (!instance) return { error: { error: 'Period instance not found', status: 404 } };

    const busyOwn = await this.repo.findPeriodInstanceAt(
      tenantId,
      instance.date,
      instance.periodIndex,
      teacherId,
    );
    if (busyOwn) {
      return { error: { error: 'cover teacher is not free (own timetable)', status: 409 } };
    }

    const busyCover = await this.repo.findAcceptedCoverAt(
      tenantId,
      instance.date,
      instance.periodIndex,
      teacherId,
    );
    if (busyCover) {
      return { error: { error: 'cover teacher is not free (accepted cover)', status: 409 } };
    }

    const updated = await this.repo.updateCoverAssignment(tenantId, coverId, {
      ...cover,
      coverTeacherMemberId: teacherId,
      state: 'offered',
      offeredAt: new Date().toISOString(),
    });
    if (!updated) return { error: { error: 'Cover assignment not found', status: 404 } };

    await this.events.publish({
      type: 'school.cover.offered',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        coverId: updated.id,
        coverTeacherMemberId: teacherId,
        periodInstanceId: updated.periodInstanceId,
      },
    });

    return { cover: updated };
  }

  async respondCover(
    tenantId: string,
    coverId: string,
    accept: boolean,
  ): Promise<{ cover?: CoverAssignment; error?: ServiceError }> {
    const cover = await this.repo.getCoverAssignment(tenantId, coverId);
    if (!cover) return { error: { error: 'Cover assignment not found', status: 404 } };
    if (cover.state !== 'offered') {
      return { error: { error: `cannot respond from state ${cover.state}`, status: 409 } };
    }

    if (accept) {
      const updated = await this.repo.updateCoverAssignment(tenantId, coverId, {
        ...cover,
        state: 'accepted',
        respondedAt: new Date().toISOString(),
      });
      if (!updated) return { error: { error: 'Cover assignment not found', status: 404 } };
      await this.events.publish({
        type: 'school.cover.assigned',
        tenantId,
        occurredAt: new Date().toISOString(),
        data: {
          coverId: updated.id,
          coverTeacherMemberId: updated.coverTeacherMemberId,
          periodInstanceId: updated.periodInstanceId,
        },
      });
      return { cover: updated };
    }

    const updated = await this.repo.updateCoverAssignment(tenantId, coverId, {
      ...cover,
      state: 'open',
      coverTeacherMemberId: null,
      offeredAt: null,
      respondedAt: new Date().toISOString(),
    });
    if (!updated) return { error: { error: 'Cover assignment not found', status: 404 } };
    return { cover: updated };
  }

  async markCoverUncovered(
    tenantId: string,
    coverId: string,
  ): Promise<{ cover?: CoverAssignment; instance?: PeriodInstance; error?: ServiceError }> {
    const cover = await this.repo.getCoverAssignment(tenantId, coverId);
    if (!cover) return { error: { error: 'Cover assignment not found', status: 404 } };
    if (cover.state !== 'open') {
      return { error: { error: `cannot mark uncovered from state ${cover.state}`, status: 409 } };
    }

    const instance = await this.repo.getPeriodInstance(tenantId, cover.periodInstanceId);
    if (!instance) return { error: { error: 'Period instance not found', status: 404 } };

    const updatedCover = await this.repo.updateCoverAssignment(tenantId, coverId, {
      ...cover,
      state: 'uncovered',
      respondedAt: new Date().toISOString(),
    });
    if (!updatedCover) return { error: { error: 'Cover assignment not found', status: 404 } };

    const updatedInstance = await this.repo.updatePeriodInstance(tenantId, instance.id, {
      ...instance,
      status: 'lost',
      lostReason: 'teacher_absent_uncovered',
    });

    await this.events.publish({
      type: 'school.period.lost',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        instanceId: instance.id,
        sectionId: instance.sectionId,
        date: instance.date,
        periodIndex: instance.periodIndex,
        allocationId: instance.allocationId,
        lostReason: 'teacher_absent_uncovered',
      },
    });

    return { cover: updatedCover, instance: updatedInstance ?? undefined };
  }

  async getCover(
    tenantId: string,
    coverId: string,
  ): Promise<{ cover?: CoverAssignment; error?: ServiceError }> {
    const cover = await this.repo.getCoverAssignment(tenantId, coverId);
    if (!cover) return { error: { error: 'Cover assignment not found', status: 404 } };
    return { cover };
  }

  /**
   * L5 teacher scope lookup (P12-05). Internal/service use only.
   * Allowed when the teacher owns the period instance's allocation, or any
   * allocation in that section (session implied by the section row).
   */
  async verifyTeacher(
    tenantId: string,
    input: {
      teacherMemberId: string;
      periodInstanceId?: string | null;
      sectionRef?: string | null;
    },
  ): Promise<{ allowed: boolean; error?: ServiceError }> {
    const teacherMemberId = (input.teacherMemberId || '').trim();
    if (!teacherMemberId) {
      return { allowed: false, error: { error: 'teacher_member_id is required', status: 400 } };
    }
    const periodInstanceId =
      input.periodInstanceId != null ? String(input.periodInstanceId).trim() : '';
    const sectionRef =
      input.sectionRef != null ? String(input.sectionRef).trim() : '';

    if (!periodInstanceId && !sectionRef) {
      return {
        allowed: false,
        error: {
          error: 'period_instance_id or section_ref is required',
          status: 400,
        },
      };
    }

    if (periodInstanceId) {
      const instance = await this.repo.getPeriodInstance(tenantId, periodInstanceId);
      if (!instance) return { allowed: false };
      const allocation = await this.repo.getAllocation(tenantId, instance.allocationId);
      if (allocation && allocation.teacherMemberId === teacherMemberId) {
        return { allowed: true };
      }
      const inSection = await this.repo.listAllocationsForTeacherInSection(
        tenantId,
        instance.sectionId,
        teacherMemberId,
      );
      return { allowed: inSection.length > 0 };
    }

    const sections = await this.repo.findSectionsByRef(tenantId, sectionRef);
    if (sections.length === 0) return { allowed: false };
    for (const section of sections) {
      const inSection = await this.repo.listAllocationsForTeacherInSection(
        tenantId,
        section.id,
        teacherMemberId,
      );
      if (inSection.length > 0) return { allowed: true };
    }
    return { allowed: false };
  }

  async listCover(
    tenantId: string,
    opts: { date?: string; state?: string },
  ): Promise<{ covers?: CoverAssignment[]; error?: ServiceError }> {
    if (opts.date && !ISO_DATE.test(opts.date)) {
      return { error: { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (opts.state) {
      const allowed = new Set(['open', 'offered', 'accepted', 'declined', 'uncovered']);
      if (!allowed.has(opts.state)) {
        return { error: { error: 'invalid cover state', status: 400 } };
      }
    }
    const covers = await this.repo.listCoverAssignments(tenantId, opts);
    return { covers };
  }

  async coverFairness(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<{ fairness?: CoverFairnessRow[]; error?: ServiceError }> {
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return { error: { error: 'from and to must be ISO dates (YYYY-MM-DD)', status: 400 } };
    }
    if (to < from) {
      return { error: { error: 'to must be on or after from', status: 400 } };
    }
    const fairness = await this.repo.coverFairness(tenantId, from, to);
    return { fairness };
  }

  async getGuardianStudentSchedule(
    tenantId: string,
    sectionRef: string,
  ): Promise<{
    section?: Section;
    slots?: SlotGridEntry[];
    error?: ServiceError;
  }> {
    const raw = (sectionRef || '').trim();
    if (!raw) {
      return { error: { error: 'section_ref is required', status: 400 } };
    }
    const sections = await this.repo.findSectionsByRef(tenantId, raw);
    if (sections.length === 0) {
      return { error: { error: 'section not found', status: 404 } };
    }
    const section = sections[0]!;
    const slots = await this.repo.listSlotGridForSection(tenantId, section.id);
    return { section, slots };
  }

  /** @deprecated Prefer getGuardianStudentSchedule */
  async getGuardianStudentTimetable(
    tenantId: string,
    sectionRef: string,
    _academicSessionId?: string,
  ): Promise<{
    section?: Section;
    slots?: SlotGridEntry[];
    error?: ServiceError;
  }> {
    return this.getGuardianStudentSchedule(tenantId, sectionRef);
  }
}
