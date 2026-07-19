export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return fallback;
}
