import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';

interface RequestWithPagination extends Request {
    pagination?: PaginationOptions;
}

interface RequestWithCursorPagination extends Request {
    cursorPagination?: CursorPaginationOptions;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
    page: number;
    limit: number;
    offset: number;
    sort?: string;
    order?: 'asc' | 'desc';
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage?: number;
    prevPage?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

/**
 * Cursor-based pagination options
 */
export interface CursorPaginationOptions {
    cursor?: string;
    limit: number;
    order?: 'asc' | 'desc';
    sort?: string;
}

/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMetadata {
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
}

/**
 * Cursor-based paginated response
 */
export interface CursorPaginatedResponse<T> {
    data: T[];
    pagination: CursorPaginationMetadata;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION = {
    page: 1,
    limit: 10,
    maxLimit: 100,
    sort: 'createdAt',
    order: 'desc' as const,
};

/**
 * Parse pagination from request query
 */
export const parsePagination = (req: Request): PaginationOptions => {
    const page = parseInt(req.query.page as string) || DEFAULT_PAGINATION.page;
    const limit = Math.min(
        parseInt(req.query.limit as string) || DEFAULT_PAGINATION.limit,
        DEFAULT_PAGINATION.maxLimit
    );
    const sort = (req.query.sort as string) || DEFAULT_PAGINATION.sort;
    const order = (req.query.order as 'asc' | 'desc') || DEFAULT_PAGINATION.order;

    // Validate page and limit
    if (page < 1) {
        throw new ValidationError('Page must be greater than 0');
    }

    if (limit < 1) {
        throw new ValidationError('Limit must be greater than 0');
    }

    if (!['asc', 'desc'].includes(order)) {
        throw new ValidationError('Order must be either "asc" or "desc"');
    }

    const offset = (page - 1) * limit;

    return {
        page,
        limit,
        offset,
        sort,
        order,
    };
};

/**
 * Parse cursor pagination from request query
 */
export const parseCursorPagination = (req: Request): CursorPaginationOptions => {
    const cursor = req.query.cursor as string;
    const limit = Math.min(
        parseInt(req.query.limit as string) || DEFAULT_PAGINATION.limit,
        DEFAULT_PAGINATION.maxLimit
    );
    const sort = (req.query.sort as string) || DEFAULT_PAGINATION.sort;
    const order = (req.query.order as 'asc' | 'desc') || DEFAULT_PAGINATION.order;

    if (limit < 1) {
        throw new ValidationError('Limit must be greater than 0');
    }

    if (!['asc', 'desc'].includes(order)) {
        throw new ValidationError('Order must be either "asc" or "desc"');
    }

    return {
        cursor,
        limit,
        sort,
        order,
    };
};

/**
 * Create pagination metadata
 */
export const createPaginationMetadata = (
    total: number,
    page: number,
    limit: number
): PaginationMetadata => {
    const pages = Math.ceil(total / limit);
    const hasNext = page < pages;
    const hasPrev = page > 1;

    return {
        page,
        limit,
        total,
        pages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : undefined,
        prevPage: hasPrev ? page - 1 : undefined,
    };
};

/**
 * Create cursor pagination metadata
 */
export const createCursorPaginationMetadata = <T>(
    data: T[],
    limit: number,
    getCursor: (item: T) => string,
    order: 'asc' | 'desc' = 'desc'
): CursorPaginationMetadata => {
    const hasNext = data.length > limit;
    const hasPrev = !!data[0]; // Assuming we have a cursor to go back

    // Remove extra item used for next page detection
    if (hasNext) {
        data.pop();
    }

    const nextCursor = hasNext ? getCursor(data[data.length - 1]) : undefined;
    const prevCursor = hasPrev ? getCursor(data[0]) : undefined;

    return {
        limit,
        hasNext,
        hasPrev,
        nextCursor,
        prevCursor,
    };
};

/**
 * Apply pagination to database query
 */
export const applyPagination = <T>(
    query: any,
    pagination: PaginationOptions
): Promise<{ data: T[]; total: number }> => {
    // Apply sorting
    const sortOrder = pagination.order === 'asc' ? 1 : -1;
    query = query.sort({ [pagination.sort!]: sortOrder });

    // Get total count
    const totalPromise = query.model.countDocuments(query.getQuery());

    // Apply pagination
    query = query.skip(pagination.offset).limit(pagination.limit);

    // Execute query
    const dataPromise = query.exec();

    return Promise.all([dataPromise, totalPromise]).then(([data, total]) => ({
        data,
        total,
    }));
};

/**
 * Apply cursor pagination to database query
 */
export const applyCursorPagination = async <T>(
    query: any,
    pagination: CursorPaginationOptions,
    getCursor: (item: T) => string
): Promise<{ data: T[]; hasNext: boolean }> => {
    const { cursor, limit, order = 'desc', sort = 'createdAt' } = pagination;

    // Apply cursor filter
    if (cursor) {
        const cursorValue = Buffer.from(cursor, 'base64').toString();
        const operator = order === 'desc' ? '$lt' : '$gt';
        query = query.where(sort, { [operator]: cursorValue });
    }

    // Apply sorting
    const sortOrder = order === 'asc' ? 1 : -1;
    query = query.sort({ [sort]: sortOrder });

    // Get one extra item to check if there's a next page
    query = query.limit(limit + 1);

    // Execute query
    const data = await query.exec();
    const hasNext = data.length > limit;

    return {
        data: hasNext ? data.slice(0, -1) : data,
        hasNext,
    };
};

/**
 * Encode cursor
 */
export const encodeCursor = (value: string): string => {
    return Buffer.from(value).toString('base64');
};

/**
 * Decode cursor
 */
export const decodeCursor = (cursor: string): string => {
    try {
        return Buffer.from(cursor, 'base64').toString();
    } catch (error) {
        throw new ValidationError('Invalid cursor format');
    }
};

/**
 * Create pagination links
 */
export const createPaginationLinks = (
    baseUrl: string,
    pagination: PaginationMetadata,
    queryParams: Record<string, any> = {}
): {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
} => {
    const links: any = {};

    // First page
    if (pagination.page > 1) {
        links.first = buildPaginationUrl(baseUrl, { ...queryParams, page: 1 });
    }

    // Previous page
    if (pagination.hasPrev && pagination.prevPage) {
        links.prev = buildPaginationUrl(baseUrl, { ...queryParams, page: pagination.prevPage });
    }

    // Next page
    if (pagination.hasNext && pagination.nextPage) {
        links.next = buildPaginationUrl(baseUrl, { ...queryParams, page: pagination.nextPage });
    }

    // Last page
    if (pagination.page < pagination.pages) {
        links.last = buildPaginationUrl(baseUrl, { ...queryParams, page: pagination.pages });
    }

    return links;
};

/**
 * Build pagination URL
 */
const buildPaginationUrl = (baseUrl: string, params: Record<string, any>): string => {
    const url = new URL(baseUrl);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.set(key, String(params[key]));
        }
    });
    return url.toString();
};

/**
 * Pagination middleware
 */
export const paginationMiddleware = (
    req: RequestWithPagination,
    res: Response,
    next: NextFunction
) => {
    try {
        req.pagination = parsePagination(req);
        next();
    } catch (error) {
        next(error);
    }
};


/**
 * Cursor pagination middleware
 */
export const cursorPaginationMiddleware = (
    req: RequestWithCursorPagination,
    res: Response,
    next: NextFunction
) => {
    try {
        req.cursorPagination = parseCursorPagination(req);
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Pagination helper class
 */
export class PaginationHelper<T> {
    constructor(
        private data: T[],
        private total: number,
        private page: number,
        private limit: number
    ) { }

    /**
     * Create paginated response
     */
    toResponse(): PaginatedResponse<T> {
        const pagination = createPaginationMetadata(this.total, this.page, this.limit);
        return {
            data: this.data,
            pagination,
        };
    }

    /**
     * Create response with links
     */
    toResponseWithLinks(baseUrl: string, queryParams: Record<string, any> = {}): {
        data: T[];
        pagination: PaginationMetadata;
        links: any;
    } {
        const pagination = createPaginationMetadata(this.total, this.page, this.limit);
        const links = createPaginationLinks(baseUrl, pagination, queryParams);

        return {
            data: this.data,
            pagination,
            links,
        };
    }
}

/**
 * Cursor pagination helper class
 */
export class CursorPaginationHelper<T> {
    constructor(
        private data: T[],
        private hasNext: boolean,
        private limit: number,
        private getCursor: (item: T) => string,
        private order: 'asc' | 'desc' = 'desc'
    ) { }

    /**
     * Create cursor paginated response
     */
    toResponse(): CursorPaginatedResponse<T> {
        const pagination = createCursorPaginationMetadata(
            this.data,
            this.limit,
            this.getCursor,
            this.order
        );

        return {
            data: this.data,
            pagination,
        };
    }
}

/**
 * Pagination validator
 */
export const validatePagination = (page: number, limit: number): void => {
    if (page < 1) {
        throw new ValidationError('Page must be greater than 0');
    }

    if (limit < 1 || limit > DEFAULT_PAGINATION.maxLimit) {
        throw new ValidationError(`Limit must be between 1 and ${DEFAULT_PAGINATION.maxLimit}`);
    }
};

/**
 * Pagination calculator
 */
export class PaginationCalculator {
    /**
     * Calculate total pages
     */
    static totalPages(total: number, limit: number): number {
        return Math.ceil(total / limit);
    }

    /**
     * Calculate offset
     */
    static offset(page: number, limit: number): number {
        return (page - 1) * limit;
    }

    /**
     * Calculate next page
     */
    static nextPage(currentPage: number, totalPages: number): number | undefined {
        return currentPage < totalPages ? currentPage + 1 : undefined;
    }

    /**
     * Calculate previous page
     */
    static prevPage(currentPage: number): number | undefined {
        return currentPage > 1 ? currentPage - 1 : undefined;
    }

    /**
     * Check if page is valid
     */
    static isValidPage(page: number, totalPages: number): boolean {
        return page >= 1 && page <= totalPages;
    }

    /**
     * Calculate page range
     */
    static pageRange(currentPage: number, totalPages: number, delta: number = 2): number[] {
        const range: number[] = [];
        const start = Math.max(1, currentPage - delta);
        const end = Math.min(totalPages, currentPage + delta);

        for (let i = start; i <= end; i++) {
            range.push(i);
        }

        return range;
    }
}

/**
 * Pagination constants
 */
export const PAGINATION_CONSTANTS = {
    DEFAULT_PAGE: DEFAULT_PAGINATION.page,
    DEFAULT_LIMIT: DEFAULT_PAGINATION.limit,
    MAX_LIMIT: DEFAULT_PAGINATION.maxLimit,
    DEFAULT_SORT: DEFAULT_PAGINATION.sort,
    DEFAULT_ORDER: DEFAULT_PAGINATION.order,
};

export default {
    parsePagination,
    parseCursorPagination,
    createPaginationMetadata,
    createCursorPaginationMetadata,
    applyPagination,
    applyCursorPagination,
    encodeCursor,
    decodeCursor,
    createPaginationLinks,
    PaginationHelper,
    CursorPaginationHelper,
    PaginationCalculator,
    PAGINATION_CONSTANTS,
};