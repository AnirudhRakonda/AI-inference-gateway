export class ProviderError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly retryable: boolean;

  constructor(provider: string, message: string, code = 'PROVIDER_ERROR', retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
  }
}

export class ProviderNotFoundError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Provider "${slug}" is not registered.`);
    this.name = 'ProviderNotFoundError';
    this.slug = slug;
  }
}
