export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    status: number;
    message: string;
    timestamp: string;
    path: string;
    pagination?: PaginationMeta;
  };
}
