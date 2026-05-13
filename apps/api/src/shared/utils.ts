import { createHash, randomBytes } from 'crypto';

import { CHILD_STATUS_ARCHIVED, CHILD_STATUS_NORMAL, RECORD_STATUS_DRAFT } from './constants';

export function generateBizNo(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
}

export function generateSecureToken(size = 32): string {
  return randomBytes(size).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseDurationToSeconds(duration: string): number {
  const normalized = duration.trim();
  const match = normalized.match(/^(\d+)([smhd])$/i);
  if (!match) {
    const fallback = Number(normalized);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return value;
  }
}

export function maskMobile(mobile?: string | null): string | null {
  if (!mobile) return null;
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

export function toDateOnly(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 10);
}

export function statusToChildLabel(status: number, deletedAt?: Date | null): 'normal' | 'archived' | 'deleted' {
  if (deletedAt) return 'deleted';
  if (status === CHILD_STATUS_ARCHIVED) return 'archived';
  return status === CHILD_STATUS_NORMAL ? 'normal' : 'normal';
}

export function statusToRecordLabel(status: number): 'draft' | 'published' {
  return status === RECORD_STATUS_DRAFT ? 'draft' : 'published';
}

export function ageDisplay(birthday: Date): string {
  const today = new Date();
  const birth = new Date(birthday);
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += previousMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}岁`);
  if (months > 0 || years > 0) parts.push(`${months}月`);
  parts.push(`${Math.max(days, 0)}天`);
  return parts.join('');
}

export function parseBigInt(input: string): bigint {
  return BigInt(input);
}

export function normalizePage(page?: number): number {
  return !page || page < 1 ? 1 : page;
}

export function normalizePageSize(pageSize?: number): number {
  if (!pageSize || pageSize < 1) return 20;
  return Math.min(pageSize, 100);
}

export function extFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic') return 'heic';
  if (normalized === 'image/heif') return 'heif';
  if (normalized === 'video/mp4') return 'mp4';
  if (normalized === 'video/webm') return 'webm';
  if (normalized === 'video/quicktime') return 'mov';
  if (normalized === 'audio/mpeg') return 'mp3';
  if (normalized === 'audio/mp4' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a') return 'm4a';
  if (normalized === 'audio/aac') return 'aac';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  if (normalized === 'audio/webm') return 'webm';
  if (normalized === 'audio/ogg') return 'ogg';
  return 'bin';
}
