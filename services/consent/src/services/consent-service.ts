import type { ConsentRepository } from '../repositories/consent-repository';
import type { ConsentRecord, CreateConsentInput } from '../types';
import { BIOMETRIC_MODALITIES } from '../types';

export class ConsentService {
  constructor(private readonly repo: ConsentRepository) {}

  async create(input: CreateConsentInput): Promise<{ success: boolean; consent?: ConsentRecord; error?: string }> {
    if (!input.subjectRef?.trim()) return { success: false, error: 'subject_ref is required' };
    if (!input.modality) return { success: false, error: 'modality is required' };

    if (BIOMETRIC_MODALITIES.has(input.modality)) {
      if (!input.alternativeAcknowledged) {
        return {
          success: false,
          error: 'Biometric consent requires acknowledging a non-detrimental alternative',
        };
      }
      if (input.subjectType === 'student' && !input.guardianRef?.trim()) {
        return { success: false, error: 'Student biometric consent requires guardian_ref' };
      }
      if (
        input.subjectType === 'student' &&
        (input.modality === 'face' || input.modality === 'iris' || input.modality === 'fingerprint') &&
        !input.dpiaRef?.trim()
      ) {
        return { success: false, error: 'Student biometric consent requires dpia_ref' };
      }
    }

    const consent = await this.repo.create(input);
    return { success: true, consent };
  }

  async validate(tenantId: string, consentRef: string, modality: string): Promise<boolean> {
    if (!consentRef) return false;
    return this.repo.isValid(tenantId, consentRef, modality);
  }

  async get(tenantId: string, id: string): Promise<ConsentRecord | null> {
    return this.repo.getById(tenantId, id);
  }

  async revoke(tenantId: string, id: string): Promise<{ success: boolean; error?: string }> {
    const ok = await this.repo.revoke(tenantId, id);
    if (!ok) return { success: false, error: 'Consent not found or already revoked' };
    return { success: true };
  }

  async listForSubject(tenantId: string, subjectRef: string): Promise<ConsentRecord[]> {
    return this.repo.listForSubject(tenantId, subjectRef);
  }
}
