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

export const diffCalendarAge = (birthday: Date | string, target: Date | string) => {
  const birth = getCalendarDateParts(birthday);
  const end = getCalendarDateParts(target);
  if (!birth || !end || compareCalendarDate(end, birth) < 0) {
    return { years: 0, months: 0, days: 0 };
  }

  let totalMonths = (end.year - birth.year) * 12 + end.month - birth.month;
  if (compareCalendarDate(addCalendarMonths(birth, totalMonths), end) > 0) {
    totalMonths -= 1;
  }

  const normalizedMonths = Math.max(totalMonths, 0);
  const anchor = addCalendarMonths(birth, normalizedMonths);
  return {
    years: Math.floor(normalizedMonths / 12),
    months: normalizedMonths % 12,
    days: Math.max(0, calendarDateToUtcDay(end) - calendarDateToUtcDay(anchor)),
  };
};

export const formatAgeAtEvent = (birthday?: string | null, eventTime?: string) => {
  if (!birthday || !eventTime) return '';
  const { years, months, days } = diffCalendarAge(birthday, eventTime);
  if (years <= 0 && months <= 0) return `${days}天`;
  if (years > 0) return `${years}岁${months > 0 ? `${months}个月` : ''}`;
  return `${months}个月`;
};
