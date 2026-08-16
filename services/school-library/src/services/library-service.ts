import { v4 as uuidv4 } from 'uuid';
import type { LibraryRepository } from '../repositories/library-repository';
import { normalizeIsbn13 } from './isbn';
import type {
  CopyCondition,
  CopyStatus,
  LibraryCopy,
  LibraryTitle,
  LibraryTitleDetail,
  ServiceError,
} from '../types';
import { COPY_CONDITIONS, COPY_STATUSES } from '../types';

function asStringArray(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function isCopyCondition(v: string): v is CopyCondition {
  return (COPY_CONDITIONS as readonly string[]).includes(v);
}

function isCopyStatus(v: string): v is CopyStatus {
  return (COPY_STATUSES as readonly string[]).includes(v);
}

export class LibraryService {
  constructor(private readonly repo: LibraryRepository) {}

  async createTitle(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{ title?: LibraryTitle; error?: ServiceError }> {
    const title = String(input.title ?? '').trim();
    if (!title) return { error: { error: 'title is required', status: 400 } };

    const isbnRaw =
      input.isbn13 !== undefined
        ? input.isbn13
        : input.isbn !== undefined
          ? input.isbn
          : null;
    const isbn = normalizeIsbn13(
      isbnRaw === null || isbnRaw === undefined ? null : String(isbnRaw),
    );
    if ('error' in isbn) return { error: { error: 'isbn_invalid', status: 400 } };

    const authors = asStringArray(input.authors ?? input.authors_json);
    if (authors === null) {
      return { error: { error: 'authors must be an array', status: 400 } };
    }
    const subjects = asStringArray(input.subjects ?? input.subjects_json);
    if (subjects === null) {
      return { error: { error: 'subjects must be an array', status: 400 } };
    }

    let publishedYear: number | null = null;
    if (input.published_year !== undefined || input.publishedYear !== undefined) {
      const raw = input.published_year ?? input.publishedYear;
      if (raw === null || raw === '') {
        publishedYear = null;
      } else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1000 || n > 9999) {
          return { error: { error: 'published_year invalid', status: 400 } };
        }
        publishedYear = n;
      }
    }

    const language = String(input.language ?? 'en').trim() || 'en';
    const publisherRaw = input.publisher;
    const publisher =
      publisherRaw === undefined || publisherRaw === null || publisherRaw === ''
        ? null
        : String(publisherRaw).trim();

    const id = uuidv4();
    try {
      const created = await this.repo.insertTitle({
        id,
        tenantId,
        isbn13: isbn.isbn13,
        title,
        authorsJson: JSON.stringify(authors),
        publisher,
        publishedYear,
        subjectsJson: JSON.stringify(subjects),
        language,
        active: input.active === false || input.active === 0 ? 0 : 1,
      });
      return { title: created };
    } catch (err) {
      if (this.repo.isUniqueConstraintError(err)) {
        return { error: { error: 'isbn_conflict', status: 409 } };
      }
      throw err;
    }
  }

  async listTitles(
    tenantId: string,
    query: { q?: string; subject?: string },
  ): Promise<{ titles: LibraryTitle[] }> {
    const titles = await this.repo.listTitles(tenantId, {
      q: query.q?.trim() || undefined,
      subject: query.subject?.trim() || undefined,
    });
    return { titles };
  }

  async getTitle(
    tenantId: string,
    id: string,
  ): Promise<{ title?: LibraryTitleDetail; error?: ServiceError }> {
    const title = await this.repo.getTitle(tenantId, id);
    if (!title) return { error: { error: 'not_found', status: 404 } };
    const copyCounts = await this.repo.copyCounts(tenantId, id);
    return { title: { ...title, copyCounts } };
  }

  async updateTitle(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<{ title?: LibraryTitle; error?: ServiceError }> {
    const existing = await this.repo.getTitle(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };

    const patch: {
      isbn13?: string | null;
      title?: string;
      authorsJson?: string;
      publisher?: string | null;
      publishedYear?: number | null;
      subjectsJson?: string;
      language?: string;
      active?: number;
    } = {};

    if (input.title !== undefined) {
      const title = String(input.title).trim();
      if (!title) return { error: { error: 'title is required', status: 400 } };
      patch.title = title;
    }

    if (input.isbn13 !== undefined || input.isbn !== undefined) {
      const raw = input.isbn13 !== undefined ? input.isbn13 : input.isbn;
      const isbn = normalizeIsbn13(raw === null ? null : String(raw));
      if ('error' in isbn) return { error: { error: 'isbn_invalid', status: 400 } };
      patch.isbn13 = isbn.isbn13;
    }

    if (input.authors !== undefined || input.authors_json !== undefined) {
      const authors = asStringArray(input.authors ?? input.authors_json);
      if (authors === null) {
        return { error: { error: 'authors must be an array', status: 400 } };
      }
      patch.authorsJson = JSON.stringify(authors);
    }

    if (input.subjects !== undefined || input.subjects_json !== undefined) {
      const subjects = asStringArray(input.subjects ?? input.subjects_json);
      if (subjects === null) {
        return { error: { error: 'subjects must be an array', status: 400 } };
      }
      patch.subjectsJson = JSON.stringify(subjects);
    }

    if (input.publisher !== undefined) {
      patch.publisher =
        input.publisher === null || input.publisher === ''
          ? null
          : String(input.publisher).trim();
    }

    if (input.published_year !== undefined || input.publishedYear !== undefined) {
      const raw = input.published_year ?? input.publishedYear;
      if (raw === null || raw === '') {
        patch.publishedYear = null;
      } else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1000 || n > 9999) {
          return { error: { error: 'published_year invalid', status: 400 } };
        }
        patch.publishedYear = n;
      }
    }

    if (input.language !== undefined) {
      const language = String(input.language).trim();
      if (!language) return { error: { error: 'language invalid', status: 400 } };
      patch.language = language;
    }

    if (input.active !== undefined) {
      patch.active = input.active === false || input.active === 0 ? 0 : 1;
    }

    try {
      const updated = await this.repo.updateTitle(tenantId, id, patch);
      return { title: updated };
    } catch (err) {
      if (this.repo.isUniqueConstraintError(err)) {
        return { error: { error: 'isbn_conflict', status: 409 } };
      }
      throw err;
    }
  }

  async deleteTitle(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const existing = await this.repo.getTitle(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };
    const n = await this.repo.countCopiesForTitle(tenantId, id);
    if (n > 0) {
      return { error: { error: 'copies_exist', status: 409 } };
    }
    await this.repo.deleteTitle(tenantId, id);
    return { ok: true };
  }

  async createCopy(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{ copy?: LibraryCopy; error?: ServiceError }> {
    const titleId = String(input.title_id ?? input.titleId ?? '').trim();
    if (!titleId) return { error: { error: 'title_id is required', status: 400 } };
    const title = await this.repo.getTitle(tenantId, titleId);
    if (!title) return { error: { error: 'title_not_found', status: 404 } };

    const barcode = String(input.barcode ?? '').trim();
    if (!barcode) return { error: { error: 'barcode is required', status: 400 } };

    const conditionRaw = String(input.condition ?? 'good');
    if (!isCopyCondition(conditionRaw)) {
      return { error: { error: 'condition invalid', status: 400 } };
    }
    const statusRaw = String(input.status ?? 'available');
    if (!isCopyStatus(statusRaw)) {
      return { error: { error: 'status invalid', status: 400 } };
    }
    if (conditionRaw === 'lost' && statusRaw === 'on_loan') {
      return { error: { error: 'status invalid', status: 400 } };
    }
    if (statusRaw === 'on_loan') {
      // Fresh copies start available/reserved/withdrawn only via catalogue create.
      return { error: { error: 'status invalid', status: 400 } };
    }

    const id = uuidv4();
    try {
      const copy = await this.repo.insertCopy({
        id,
        tenantId,
        titleId,
        barcode,
        accessionNo:
          input.accession_no === undefined && input.accessionNo === undefined
            ? null
            : input.accession_no === null || input.accessionNo === null
              ? null
              : String(input.accession_no ?? input.accessionNo).trim() || null,
        condition: conditionRaw,
        status: statusRaw,
        locationLabel:
          input.location_label === undefined && input.locationLabel === undefined
            ? null
            : input.location_label === null || input.locationLabel === null
              ? null
              : String(input.location_label ?? input.locationLabel).trim() || null,
        acquiredOn:
          input.acquired_on === undefined && input.acquiredOn === undefined
            ? null
            : input.acquired_on === null || input.acquiredOn === null
              ? null
              : String(input.acquired_on ?? input.acquiredOn).trim() || null,
      });
      return { copy };
    } catch (err) {
      if (this.repo.isUniqueConstraintError(err)) {
        return { error: { error: 'barcode_conflict', status: 409 } };
      }
      throw err;
    }
  }

  async listCopies(
    tenantId: string,
    query: { titleId?: string; status?: string; barcode?: string },
  ): Promise<{ copies: LibraryCopy[]; error?: ServiceError }> {
    if (query.status && !isCopyStatus(query.status)) {
      return { copies: [], error: { error: 'status invalid', status: 400 } };
    }
    const copies = await this.repo.listCopies(tenantId, {
      titleId: query.titleId,
      status: query.status,
      barcode: query.barcode,
    });
    return { copies };
  }

  async getCopy(
    tenantId: string,
    id: string,
  ): Promise<{ copy?: LibraryCopy; error?: ServiceError }> {
    const copy = await this.repo.getCopy(tenantId, id);
    if (!copy) return { error: { error: 'not_found', status: 404 } };
    return { copy };
  }

  async updateCopy(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<{ copy?: LibraryCopy; error?: ServiceError }> {
    const existing = await this.repo.getCopy(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };

    const patch: {
      barcode?: string;
      accessionNo?: string | null;
      condition?: CopyCondition;
      status?: CopyStatus;
      locationLabel?: string | null;
      acquiredOn?: string | null;
    } = {};

    if (input.barcode !== undefined) {
      const barcode = String(input.barcode).trim();
      if (!barcode) return { error: { error: 'barcode is required', status: 400 } };
      patch.barcode = barcode;
    }

    if (input.condition !== undefined) {
      const conditionRaw = String(input.condition);
      if (!isCopyCondition(conditionRaw)) {
        return { error: { error: 'condition invalid', status: 400 } };
      }
      patch.condition = conditionRaw;
    }

    if (input.status !== undefined) {
      const statusRaw = String(input.status);
      if (!isCopyStatus(statusRaw)) {
        return { error: { error: 'status invalid', status: 400 } };
      }
      if (existing.status === 'withdrawn' && statusRaw === 'on_loan') {
        return { error: { error: 'withdrawn_cannot_loan', status: 409 } };
      }
      patch.status = statusRaw;
    }

    if (input.accession_no !== undefined || input.accessionNo !== undefined) {
      const raw = input.accession_no ?? input.accessionNo;
      patch.accessionNo =
        raw === null || raw === '' ? null : String(raw).trim() || null;
    }

    if (input.location_label !== undefined || input.locationLabel !== undefined) {
      const raw = input.location_label ?? input.locationLabel;
      patch.locationLabel =
        raw === null || raw === '' ? null : String(raw).trim() || null;
    }

    if (input.acquired_on !== undefined || input.acquiredOn !== undefined) {
      const raw = input.acquired_on ?? input.acquiredOn;
      patch.acquiredOn =
        raw === null || raw === '' ? null : String(raw).trim() || null;
    }

    try {
      const copy = await this.repo.updateCopy(tenantId, id, patch);
      return { copy };
    } catch (err) {
      if (this.repo.isUniqueConstraintError(err)) {
        return { error: { error: 'barcode_conflict', status: 409 } };
      }
      throw err;
    }
  }

  async deleteCopy(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const existing = await this.repo.getCopy(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };
    await this.repo.deleteCopy(tenantId, id);
    return { ok: true };
  }
}
