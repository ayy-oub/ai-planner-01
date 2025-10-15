// Export all shared types
export * from '../../modules/auth/auth.types';
export * from './common.types';
export * from './error.types';
export * from './api-response.types';
export * from './database.types';

// Re-export commonly used types for convenience
export type {
    User,
    UserRole,
    UserPreferences,
    UserSubscription,
    UserStatistics,
    UserSecurity,
} from '../../modules/user/user.types';

export type {
    PaginationOptions,
    PaginationMetadata,
    PaginatedResponse,
    CursorPaginationOptions,
    CursorPaginationMetadata,
    CursorPaginatedResponse,
    SortOptions,
    FilterOptions,
    SearchOptions,
    ErrorTrackingInfo,
    ValidationResult
} from './common.types';

export type {
    AppErrorCode,
    HttpStatusCode,
    ErrorResponse,
    SuccessResponse,
    ValidationError,
    FieldError,
} from './error.types';

export type {
    ApiResponse as ApiResponseType,
    ResponseMetadata,
    PaginationInfo,
    AuthResponse
} from './api-response.types';

export type {
    DatabaseEntity,
    TimestampedEntity,
    SoftDeletableEntity,
    BaseDocument,
    FirestoreDocument,
    CollectionName,
} from './database.types';