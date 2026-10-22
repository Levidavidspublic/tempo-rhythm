export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

export class AiAuthError extends AiError {
  constructor(message: string) {
    super(message);
    this.name = "AiAuthError";
  }
}

/** Configuration failures retain existing callers' friendly auth/configuration handling. */
export class AiConfigurationError extends AiAuthError {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class AiCancelledError extends AiError {
  constructor(message: string) {
    super(message);
    this.name = "AiCancelledError";
  }
}

export class AiRateLimitedError extends AiError {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = "AiRateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class AiContextTooLargeError extends AiError {
  constructor(message: string) {
    super(message);
    this.name = "AiContextTooLargeError";
  }
}

export class AiUpstreamError extends AiError {
  status: number;
  upstream: string;
  constructor(message: string, status: number, upstream: string) {
    super(message);
    this.name = "AiUpstreamError";
    this.status = status;
    this.upstream = upstream;
  }
}
