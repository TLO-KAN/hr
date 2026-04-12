import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

/**
 * Centralized date formatting utility for consistency across the app
 */

/** Format date as "1 Jan" (e.g., "15 มค") */
export const formatDateShort = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'd MMM', { locale: th });
  } catch {
    return '-';
  }
};

/** Format date as "1 Jan 2024" (e.g., "15 มค 2567") */
export const formatDateMedium = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'd MMM yyyy', { locale: th });
  } catch {
    return '-';
  }
};

/** Format date as "1 Jan 2024 14:30" (e.g., "15 มค 2567 14:30") */
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'd MMM yyyy HH:mm', { locale: th });
  } catch {
    return '-';
  }
};

/** Format date range as "1 Jan - 5 Jan 2024" */
export const formatDateRange = (startDate: string | Date | null | undefined, endDate: string | Date | null | undefined): string => {
  if (!startDate || !endDate) return '-';
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    return `${format(start, 'd MMM', { locale: th })} - ${format(end, 'd MMM yyyy', { locale: th })}`;
  } catch {
    return '-';
  }
};

/** Get day name in Thai (e.g., "จันทร์", "อังคาร") */
export const getDayNameTh = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'EEEE', { locale: th });
  } catch {
    return '-';
  }
};

/** Format to database-compatible format "YYYY-MM-DD" */
export const formatISO = (date: Date | null | undefined): string => {
  if (!date) return '';
  try {
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};
