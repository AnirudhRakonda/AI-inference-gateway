import { ProviderNotFoundError } from './errors.js';
import type { LLMProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.slug.toLowerCase(), provider);
  }

  get(slug: string): LLMProvider | undefined {
    return this.providers.get(slug.toLowerCase());
  }

  resolve(slug: string): LLMProvider {
    const provider = this.get(slug);
    if (!provider) {
      throw new ProviderNotFoundError(slug);
    }
    return provider;
  }

  list(): LLMProvider[] {
    return [...this.providers.values()];
  }

  has(slug: string): boolean {
    return this.providers.has(slug.toLowerCase());
  }

  clear(): void {
    this.providers.clear();
  }
}
