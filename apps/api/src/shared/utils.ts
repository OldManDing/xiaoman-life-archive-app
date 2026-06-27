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

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

const APP_CALENDAR_TIME_ZONE = 'Asia/Shanghai';
const MS_PER_DAY = 86_400_000;

const getCalendarDateParts = (value: Date | string, timeZone = APP_CALENDAR_TIME_ZONE): CalendarDateParts | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const getPart = (type: 'year' | 'month' | 'day') => Number(parts.find((part) => part.type === type)?.value);
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  if (![year, month, day].every(Number.isFinite)) return null;
  return { year, month, day };
};

const compareCalendarDate = (left: CalendarDateParts, right: CalendarDateParts) => {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const addCalendarMonths = (date: CalendarDateParts, months: number): CalendarDateParts => {
  const monthIndex = date.month - 1 + months;
  const year = date.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, daysInMonth(year, month));
  return { year, month, day };
};

const calendarDateToUtcDay = (date: CalendarDateParts) => Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;

const diffCalendarAge = (birthday: Date | string, target: Date | string) => {
  const birth = getCalendarDateParts(birthday);
  const end = getCalendarDateParts(target);
  if (!birth || !end || compareCalendarDate(end, birth) < 0) {
    return { years: 0, months: 0, days: 0 };
  }

  let totalMonths = (end.year - birth.year) * 12 + end.month - birth.month;
  if (compareCalendarDate(addCalendarMonths(birth, totalMonths), end) > 0) {
    totalMonths -= 1;
  }

  const anchor = addCalendarMonths(birth, Math.max(totalMonths, 0));
  return {
    years: Math.floor(Math.max(totalMonths, 0) / 12),
    months: Math.max(totalMonths, 0) % 12,
    days: Math.max(0, calendarDateToUtcDay(end) - calendarDateToUtcDay(anchor)),
  };
};

export function ageDisplay(birthday: Date, today = new Date()): string {
  const { years, months, days } = diffCalendarAge(birthday, today);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}岁`);
  if (months > 0 || years > 0) parts.push(`${months}月`);
  parts.push(`${days}天`);
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
  const normalized = mimeType.toLowerCase().split(';', 1)[0].trim();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic') return 'heic';
  if (normalized === 'image/heif') return 'heif';
  if (normalized === 'video/mp4') return 'mp4';
  if (normalized === 'video/webm') return 'webm';
  if (normalized === 'video/quicktime') return 'mov';
  if (normalized === 'video/3gpp') return '3gp';
  if (normalized === 'audio/mpeg') return 'mp3';
  if (normalized === 'audio/mp4' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a') return 'm4a';
  if (normalized === 'audio/aac') return 'aac';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  if (normalized === 'audio/webm') return 'webm';
  if (normalized === 'audio/ogg') return 'ogg';
  if (normalized === 'audio/3gpp') return '3gp';
  if (normalized === 'audio/amr') return 'amr';
  return 'bin';
}
