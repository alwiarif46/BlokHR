import type { StatePack } from './types';
import { mhPack } from './mh';
import { tnPack } from './tn';
import { kaPack } from './ka';

const PACKS: Record<string, StatePack> = {
  MH: mhPack,
  TN: tnPack,
  KA: kaPack,
};

export function listStatePacks(): Array<{ code: string; label: string }> {
  return Object.values(PACKS).map((p) => ({ code: p.code, label: p.label }));
}

export function getStatePack(code: string): StatePack | null {
  const key = code.trim().toUpperCase();
  return PACKS[key] ?? null;
}

export function listStatePackCodes(): string[] {
  return Object.keys(PACKS);
}

export type { StatePack, StatePackCategory, StatePackGradeScheme, StatePackStudentIdField } from './types';
