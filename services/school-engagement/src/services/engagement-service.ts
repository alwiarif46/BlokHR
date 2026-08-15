import { v4 as uuidv4 } from 'uuid';
import type { EngagementRepository } from '../repositories/engagement-repository';
import type {
  ChannelInput,
  ChannelKind,
  DigestFrequency,
  EngagementSettings,
  GuardianChannel,
  PutSettingsInput,
} from '../types';

type ServiceError = { error: string; status: number };

const CHANNELS = new Set<ChannelKind>(['push', 'whatsapp', 'sms', 'ivr']);
const FREQUENCIES = new Set<DigestFrequency>(['daily', 'weekly']);

const DEFAULT_SETTINGS = {
  dailyCapPerStudent: 3,
  digestHour: 17,
  digestFrequency: 'daily' as DigestFrequency,
  quietStart: 21,
  quietEnd: 7,
};

export class EngagementService {
  constructor(private readonly repo: EngagementRepository) {}

  async listChannels(
    tenantId: string,
    guardianRef: string,
  ): Promise<{ channels?: GuardianChannel[]; error?: ServiceError }> {
    const ref = (guardianRef || '').trim();
    if (!ref) return { error: { error: 'guardian_ref is required', status: 400 } };
    return { channels: await this.repo.listChannels(tenantId, ref) };
  }

  async putChannels(
    tenantId: string,
    guardianRef: string,
    inputs: ChannelInput[],
  ): Promise<{ channels?: GuardianChannel[]; error?: ServiceError }> {
    const ref = (guardianRef || '').trim();
    if (!ref) return { error: { error: 'guardian_ref is required', status: 400 } };
    if (!Array.isArray(inputs)) {
      return { error: { error: 'channels array is required', status: 400 } };
    }

    const normalized: ChannelInput[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const row = inputs[i]!;
      if (!CHANNELS.has(row.channel)) {
        return { error: { error: `channels[${i}]: invalid channel`, status: 400 } };
      }
      const address = String(row.address ?? '').trim();
      if (!address) {
        return { error: { error: `channels[${i}]: address is required`, status: 400 } };
      }
      const priority = Number(row.priority);
      if (!Number.isInteger(priority) || priority < 1) {
        return {
          error: { error: `channels[${i}]: priority must be a positive integer`, status: 400 },
        };
      }
      normalized.push({
        channel: row.channel,
        address,
        verified: Boolean(row.verified),
        priority,
        isActive: row.isActive === undefined ? true : Boolean(row.isActive),
      });
    }

    // Full replace, persist in priority order
    normalized.sort((a, b) => a.priority - b.priority);
    await this.repo.deleteChannelsForGuardian(tenantId, ref);
    for (const row of normalized) {
      await this.repo.insertChannel({
        id: uuidv4(),
        tenantId,
        guardianRef: ref,
        channel: row.channel,
        address: row.address,
        verified: Boolean(row.verified),
        priority: row.priority,
        isActive: row.isActive !== false,
        createdAt: '',
        updatedAt: '',
      });
    }
    return { channels: await this.repo.listChannels(tenantId, ref) };
  }

  async getSettings(
    tenantId: string,
  ): Promise<{ settings: EngagementSettings }> {
    const existing = await this.repo.getSettings(tenantId);
    if (existing) return { settings: existing };
    return {
      settings: {
        tenantId,
        ...DEFAULT_SETTINGS,
        updatedAt: '',
      },
    };
  }

  async putSettings(
    tenantId: string,
    input: PutSettingsInput,
  ): Promise<{ settings?: EngagementSettings; error?: ServiceError }> {
    const current = (await this.getSettings(tenantId)).settings;

    let dailyCapPerStudent = current.dailyCapPerStudent;
    let digestHour = current.digestHour;
    let digestFrequency = current.digestFrequency;
    let quietStart = current.quietStart;
    let quietEnd = current.quietEnd;

    if (input.dailyCapPerStudent !== undefined) {
      dailyCapPerStudent = Number(input.dailyCapPerStudent);
      if (
        !Number.isInteger(dailyCapPerStudent) ||
        dailyCapPerStudent < 1 ||
        dailyCapPerStudent > 10
      ) {
        return { error: { error: 'daily_cap_per_student must be 1–10', status: 400 } };
      }
    }
    if (input.digestHour !== undefined) {
      digestHour = Number(input.digestHour);
      if (!Number.isInteger(digestHour) || digestHour < 0 || digestHour > 23) {
        return { error: { error: 'digest_hour must be 0–23', status: 400 } };
      }
    }
    if (input.digestFrequency !== undefined) {
      if (!FREQUENCIES.has(input.digestFrequency)) {
        return { error: { error: 'digest_frequency must be daily or weekly', status: 400 } };
      }
      digestFrequency = input.digestFrequency;
    }
    if (input.quietStart !== undefined) {
      quietStart = Number(input.quietStart);
      if (!Number.isInteger(quietStart) || quietStart < 0 || quietStart > 23) {
        return { error: { error: 'quiet_start must be 0–23', status: 400 } };
      }
    }
    if (input.quietEnd !== undefined) {
      quietEnd = Number(input.quietEnd);
      if (!Number.isInteger(quietEnd) || quietEnd < 0 || quietEnd > 23) {
        return { error: { error: 'quiet_end must be 0–23', status: 400 } };
      }
    }

    const settings = await this.repo.upsertSettings({
      tenantId,
      dailyCapPerStudent,
      digestHour,
      digestFrequency,
      quietStart,
      quietEnd,
      updatedAt: '',
    });
    return { settings };
  }
}
