// ProxyAI Standard API Response Types
// Blueprint Reference: Sprint 9 — API Standards

export interface ApiSuccess<T = unknown> {
  success: true
  data: T
  request_id?: string
}

export interface ApiError {
  success: false
  code: string
  message: string
  request_id?: string
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

export function successResponse<T>(data: T, requestId?: string): ApiSuccess<T> {
  return {
    success: true,
    data,
    ...(requestId ? { request_id: requestId } : {}),
  }
}

export function errorResponse(code: string, message: string, requestId?: string): ApiError {
  return {
    success: false,
    code,
    message,
    ...(requestId ? { request_id: requestId } : {}),
  }
}
