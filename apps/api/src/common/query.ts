import { BadRequestException } from "@nestjs/common";

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

export function parsePagination(pageValue?: string, limitValue?: string): Pagination {
  const page = parsePositiveInteger(pageValue, 1, "page");
  const requestedLimit = parsePositiveInteger(limitValue, 20, "limit");
  const limit = Math.min(requestedLimit, 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

export function parseOptionalDate(value: string | undefined, fieldName: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Tarih geçersiz.");
  }

  return date;
}

function parsePositiveInteger(value: string | undefined, fallback: number, fieldName: string) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException("Sayı geçersiz.");
  }

  return parsed;
}

