import { format, isValid, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

export type DateInput = string | number | Date | null | undefined;

const DEFAULT_DATE_TIME_PATTERN = "dd/MM/yyyy HH:mm";
const DEFAULT_DATE_PATTERN = "dd/MM/yyyy";
const DEFAULT_TIME_PATTERN = "HH:mm";

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "string") {
    const isoDate = parseISO(value);
    if (isValid(isoDate)) {
      return isoDate;
    }

    const fallbackDate = new Date(value);
    return isValid(fallbackDate) ? fallbackDate : null;
  }

  const date = new Date(value);
  return isValid(date) ? date : null;
};

export const formatDateTime = (
  value: DateInput,
  pattern: string = DEFAULT_DATE_TIME_PATTERN,
): string => {
  const date = toDate(value);
  if (!date) {
    return "-";
  }
  return format(date, pattern, { locale: vi });
};

export const formatDate = (
  value: DateInput,
  pattern: string = DEFAULT_DATE_PATTERN,
): string => {
  return formatDateTime(value, pattern);
};

export const formatTime = (
  value: DateInput,
  pattern: string = DEFAULT_TIME_PATTERN,
): string => {
  return formatDateTime(value, pattern);
};

export const getCurrentYear = (): string => {
  return format(new Date(), "yyyy", { locale: vi });
};
