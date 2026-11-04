export function ok<T>(data: T) {
  return { data };
}

export function paginated<T>(
  data: T[],
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
) {
  return {
    data,
    meta
  };
}

