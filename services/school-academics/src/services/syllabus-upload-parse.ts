/**
 * Parse Excel/CSV school syllabus workbooks (Syllabus + optional Lesson Plans sheets).
 */
import * as XLSX from 'xlsx';
import type { CourseBoard, ImportUnit, LessonBody } from '../types';
import { validateImportUnits } from './syllabus-import-validate';

const MAX_BASE64_BYTES = 4 * 1024 * 1024;

const CLASS_HEADERS = new Set(['class', 'class_label', 'class label', 'grade', 'standard']);
const SUBJECT_HEADERS = new Set([
  'subject',
  'subject_code',
  'subject code',
  'subject_code',
]);
const COURSE_LABEL_HEADERS = new Set(['course_label', 'course label', 'course', 'course name']);
const UNIT_HEADERS = new Set(['unit', 'unit_label', 'unit label', 'unit name']);
const WEEKS_HEADERS = new Set(['planned_weeks', 'planned weeks', 'weeks']);
const TOPIC_HEADERS = new Set(['topic', 'topic_label', 'topic label', 'topic name']);
const PERIODS_HEADERS = new Set([
  'estimated_periods',
  'estimated periods',
  'periods',
  'period',
]);
const DATE_HEADERS = new Set([
  'date',
  'lesson_date',
  'lesson date',
  'day',
  'lesson_day',
]);
const TITLE_HEADERS = new Set(['title', 'lesson_title', 'lesson title', 'name']);
const TEACHER_HEADERS = new Set([
  'teacher',
  'teacher_email',
  'teacher email',
  'teacher_member_id',
  'teacher member id',
]);
const OBJECTIVES_HEADERS = new Set(['objectives', 'objective']);
const ACTIVITIES_HEADERS = new Set(['activities', 'activity']);
const MATERIALS_HEADERS = new Set(['materials', 'material']);
const ASSESSMENT_HEADERS = new Set([
  'assessment',
  'assessment_check',
  'assessment check',
]);

export interface ParsedSyllabusCourse {
  classLabel: string;
  subjectCode: string;
  label: string;
  units: ImportUnit[];
}

export interface ParsedLessonPlanRow {
  row: number;
  classLabel: string;
  subjectCode: string;
  unitLabel: string;
  topicLabel: string;
  dateIso: string;
  title: string;
  teacher: string;
  body: LessonBody;
}

export interface SyllabusParseWarning {
  row: number;
  sheet: string;
  message: string;
}

export interface ParsedSyllabusWorkbook {
  courses: ParsedSyllabusCourse[];
  lessonPlans: ParsedLessonPlanRow[];
  lessonWarnings: SyllabusParseWarning[];
  classesInFile: string[];
  parseErrors: string[];
}

function headerKey(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase();
}

function findColumn(headers: string[], candidates: Set<string>): number {
  return headers.findIndex((h) => candidates.has(h));
}

function cell(row: unknown[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  const v = row[idx];
  if (v == null) return '';
  return String(v).trim();
}

export function decodeSyllabusUploadBase64(
  contentBase64: string,
): Buffer | { error: string } {
  const cleaned = contentBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleaned) return { error: 'contentBase64 is required' };
  let buf: Buffer;
  try {
    buf = Buffer.from(cleaned, 'base64');
  } catch {
    return { error: 'Invalid base64 content' };
  }
  if (!buf.length) return { error: 'Empty file' };
  if (buf.length > MAX_BASE64_BYTES) return { error: 'File too large (max 4MB)' };
  return buf;
}

export function normalizeUploadDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y >= 1900 && parsed.y <= 2100) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return null;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

/** ISO Monday (UTC) for the week containing the given YYYY-MM-DD. */
export function mondayOfWeek(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return isoDate;
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sheetMatrix(workbook: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

function pickSyllabusSheet(workbook: XLSX.WorkBook): string | null {
  const named = workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'syllabus');
  if (named) return named;
  return workbook.SheetNames[0] ?? null;
}

function pickLessonPlansSheet(workbook: XLSX.WorkBook): string | null {
  return (
    workbook.SheetNames.find((n) => {
      const k = n.trim().toLowerCase();
      return k === 'lesson plans' || k === 'lesson_plans' || k === 'lessons';
    }) ?? null
  );
}

/**
 * Parse workbook buffer into syllabus courses + optional lesson plan rows.
 */
export function parseSyllabusWorkbook(buffer: Buffer): ParsedSyllabusWorkbook {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const result: ParsedSyllabusWorkbook = {
    courses: [],
    lessonPlans: [],
    lessonWarnings: [],
    classesInFile: [],
    parseErrors: [],
  };

  const sylName = pickSyllabusSheet(workbook);
  if (!sylName) {
    result.parseErrors.push('Workbook has no sheets');
    return result;
  }

  const matrix = sheetMatrix(workbook, sylName);
  if (!matrix.length) {
    result.parseErrors.push('Syllabus sheet is empty');
    return result;
  }

  const headers = (matrix[0] ?? []).map(headerKey);
  const classIdx = findColumn(headers, CLASS_HEADERS);
  const subjectIdx = findColumn(headers, SUBJECT_HEADERS);
  const courseLabelIdx = findColumn(headers, COURSE_LABEL_HEADERS);
  const unitIdx = findColumn(headers, UNIT_HEADERS);
  const weeksIdx = findColumn(headers, WEEKS_HEADERS);
  const topicIdx = findColumn(headers, TOPIC_HEADERS);
  const periodsIdx = findColumn(headers, PERIODS_HEADERS);

  if (classIdx < 0 || subjectIdx < 0 || unitIdx < 0 || topicIdx < 0) {
    result.parseErrors.push(
      'Syllabus header must include Class, Subject, Unit, and Topic',
    );
    return result;
  }

  type AccTopic = { label: string; estimated_periods?: number };
  type AccUnit = {
    label: string;
    planned_weeks: number;
    topics: AccTopic[];
    topicSeen: Set<string>;
  };
  type AccCourse = {
    classLabel: string;
    subjectCode: string;
    label: string;
    units: Map<string, AccUnit>;
  };

  const courses = new Map<string, AccCourse>();
  const classSet = new Set<string>();

  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const blank = raw.every((c) => c == null || String(c).trim() === '');
    if (blank) continue;

    const classLabel = cell(raw, classIdx);
    const subjectCode = cell(raw, subjectIdx);
    const unitLabel = cell(raw, unitIdx);
    const topicLabel = cell(raw, topicIdx);
    const rowNum = i + 1;

    if (!classLabel || !subjectCode || !unitLabel || !topicLabel) {
      result.parseErrors.push(
        `Syllabus row ${rowNum}: class, subject, unit, and topic are required`,
      );
      continue;
    }

    classSet.add(classLabel);
    const courseKey = classLabel + '\0' + subjectCode;
    let course = courses.get(courseKey);
    if (!course) {
      const courseLabel =
        courseLabelIdx >= 0 ? cell(raw, courseLabelIdx) : '';
      course = {
        classLabel,
        subjectCode,
        label: courseLabel || `${subjectCode} ${classLabel}`,
        units: new Map(),
      };
      courses.set(courseKey, course);
    }

    let unit = course.units.get(unitLabel);
    if (!unit) {
      let weeks = 2;
      if (weeksIdx >= 0) {
        const w = Number(cell(raw, weeksIdx));
        if (Number.isFinite(w) && w > 0) weeks = w;
      }
      unit = {
        label: unitLabel,
        planned_weeks: weeks,
        topics: [],
        topicSeen: new Set(),
      };
      course.units.set(unitLabel, unit);
    }

    if (!unit.topicSeen.has(topicLabel)) {
      unit.topicSeen.add(topicLabel);
      let estimated_periods: number | undefined;
      if (periodsIdx >= 0) {
        const p = Number(cell(raw, periodsIdx));
        if (Number.isInteger(p) && p >= 1) estimated_periods = p;
      }
      unit.topics.push(
        estimated_periods != null
          ? { label: topicLabel, estimated_periods }
          : { label: topicLabel },
      );
    }
  }

  for (const c of courses.values()) {
    const unitsWire: ImportUnit[] = [...c.units.values()].map((u) => ({
      label: u.label,
      planned_weeks: u.planned_weeks,
      topics: u.topics,
    }));
    const validated = validateImportUnits(unitsWire);
    if (validated.errors.length) {
      result.parseErrors.push(
        `${c.subjectCode} ${c.classLabel}: ${validated.errors.join('; ')}`,
      );
      continue;
    }
    result.courses.push({
      classLabel: c.classLabel,
      subjectCode: c.subjectCode,
      label: c.label,
      units: unitsWire,
    });
  }

  result.classesInFile = [...classSet].sort();

  const lessonSheet = pickLessonPlansSheet(workbook);
  if (lessonSheet && lessonSheet !== sylName) {
    const lessonMatrix = sheetMatrix(workbook, lessonSheet);
    if (lessonMatrix.length > 1) {
      const lh = (lessonMatrix[0] ?? []).map(headerKey);
      const lClass = findColumn(lh, CLASS_HEADERS);
      const lSubject = findColumn(lh, SUBJECT_HEADERS);
      const lUnit = findColumn(lh, UNIT_HEADERS);
      const lTopic = findColumn(lh, TOPIC_HEADERS);
      const lDate = findColumn(lh, DATE_HEADERS);
      const lTitle = findColumn(lh, TITLE_HEADERS);
      const lTeacher = findColumn(lh, TEACHER_HEADERS);
      const lObj = findColumn(lh, OBJECTIVES_HEADERS);
      const lAct = findColumn(lh, ACTIVITIES_HEADERS);
      const lMat = findColumn(lh, MATERIALS_HEADERS);
      const lAssess = findColumn(lh, ASSESSMENT_HEADERS);

      for (let i = 1; i < lessonMatrix.length; i += 1) {
        const raw = lessonMatrix[i] ?? [];
        const blank = raw.every((c) => c == null || String(c).trim() === '');
        if (blank) continue;
        const rowNum = i + 1;
        const classLabel = lClass >= 0 ? cell(raw, lClass) : '';
        const subjectCode = lSubject >= 0 ? cell(raw, lSubject) : '';
        const unitLabel = lUnit >= 0 ? cell(raw, lUnit) : '';
        const topicLabel = lTopic >= 0 ? cell(raw, lTopic) : '';
        const dateIso =
          lDate >= 0 ? normalizeUploadDate(raw[lDate]) : null;

        if (!classLabel || !subjectCode) {
          result.lessonWarnings.push({
            row: rowNum,
            sheet: 'Lesson Plans',
            message: 'class and subject required to attach lesson — skipped',
          });
          continue;
        }
        if (!unitLabel) {
          result.lessonWarnings.push({
            row: rowNum,
            sheet: 'Lesson Plans',
            message: 'unit required to attach lesson — skipped',
          });
          continue;
        }
        if (!dateIso) {
          result.lessonWarnings.push({
            row: rowNum,
            sheet: 'Lesson Plans',
            message: 'date required to schedule lesson — skipped',
          });
          continue;
        }

        const titleRaw = lTitle >= 0 ? cell(raw, lTitle) : '';
        const teacherRaw = lTeacher >= 0 ? cell(raw, lTeacher) : '';
        const body: LessonBody = {};
        if (lObj >= 0) body.objectives = cell(raw, lObj) || '';
        if (lAct >= 0) body.activities = cell(raw, lAct) || '';
        if (lMat >= 0) body.materials = cell(raw, lMat) || '';
        if (lAssess >= 0) body.assessment_check = cell(raw, lAssess) || '';

        result.lessonPlans.push({
          row: rowNum,
          classLabel,
          subjectCode,
          unitLabel,
          topicLabel,
          dateIso,
          title: titleRaw || topicLabel || 'Lesson plan',
          teacher: teacherRaw,
          body,
        });
      }
    }
  }

  return result;
}

export const ALLOWED_UPLOAD_BOARDS = new Set<CourseBoard>([
  'cbse',
  'icse',
  'state',
  'ib',
  'cambridge',
]);
