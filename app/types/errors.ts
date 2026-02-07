export type ApiError = {
  code?: number;
  message?: string;
  response?: {
    data?: unknown;
  };
};

export type GoogleApiError = ApiError & {
  code?: number;
  message?: string;
  response?: {
    data?: unknown;
  };
};

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object"
    && error !== null
    && ("code" in error || "message" in error || "response" in error)
  );
}

export function isGoogleApiError(error: unknown): error is GoogleApiError {
  return isApiError(error);
}
