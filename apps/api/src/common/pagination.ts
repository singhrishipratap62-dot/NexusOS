export interface PaginationParams {
    limit: number;
    offset: number;
    cursor?: string;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor?: string;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function parsePaginationParams(query: {
    limit?: string | number;
    offset?: string | number;
    cursor?: string;
}): PaginationParams {
    const rawLimit = Number(query.limit ?? DEFAULT_LIMIT);
    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
    const offset = Math.max(0, Number(query.offset ?? 0));
    return { limit, offset, cursor: query.cursor };
}

export function buildPaginatedResult<T extends { id?: string }>(
    data: T[],
    total: number,
    params: PaginationParams
): PaginatedResult<T> {
    const hasMore = params.offset + data.length < total;
    const lastItem = data[data.length - 1];
    return {
        data,
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore,
        nextCursor: hasMore && lastItem?.id ? lastItem.id : undefined
    };
}
