/** Base error shared by callers that distinguish model failures from other exceptions. */
export class AiError extends Error {
  /** Preserve the caller-supplied message and identify the model error family. */
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

/** Missing or rejected credentials, also used as the base for configuration failures. */
export class AiAuthError extends AiError {
  /** Preserve existing callers' auth-error classification. */
  constructor(message: string) {
    super(message);
    this.name = "AiAuthError";
  }
}

/** Configuration failures retain existing callers' friendly auth/configuration handling. */
export class AiConfigurationError extends AiAuthError {
  /** Identify invalid model settings while retaining auth-error compatibility. */
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

/** A request deliberately stopped by its caller rather than a provider failure. */
export class AiCancelledError extends AiError {
  /** Mark cancellation so callers can stop without treating it as a retryable failure. */
  constructor(message: string) {
    super(message);
    this.name = "AiCancelledError";
  }
}

/** Provider rate limiting with an optional parsed retry hint. */
export class AiRateLimitedError extends AiError {
  retryAfterMs?: number;
  /** Store the retry hint; the router's shared deadline still bounds any retry. */
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = "AiRateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Input exceeds the provider's context window and should not be retried unchanged. */
export class AiContextTooLargeError extends AiError {
  /** Identify an oversized prompt for callers' non-retryable error handling. */
  constructor(message: string) {
    super(message);
    this.name = "AiContextTooLargeError";
  }
}

/** Transport or provider failure; the router supplies an empty upstream body for privacy. */
export class AiUpstreamError extends AiError {
  status: number;
  upstream: string;
  /** Preserve status and legacy upstream fields; this container does not redact its arguments. */
  constructor(message: string, status: number, upstream: string) {
    super(message);
    this.name = "AiUpstreamError";
    this.status = status;
    this.upstream = upstream;
  }
}
