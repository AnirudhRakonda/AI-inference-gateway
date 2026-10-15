import { ProviderError } from '../errors.js';
import type {
  GenerateTextRequest,
  LLMProvider,
  ProviderCapabilities,
  ProviderModelDescriptor,
  ProviderResponse,
  StreamChunk,
} from '../types.js';

export type MockScenario =
  'success' | 'json' | 'empty' | 'malformed' | 'api_error' | 'rate_limit' | 'timeout';

const defaultCapabilities: ProviderCapabilities = {
  text: true,
  streaming: true,
  json: true,
  tools: false,
  vision: false,
};

const defaultModels: ProviderModelDescriptor[] = [
  {
    id: 'mock-gpt-4o-mini',
    name: 'Mock GPT-4o Mini',
    contextWindow: 128000,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    capabilities: { text: true, streaming: true, json: true },
  },
  {
    id: 'mock-claude-haiku',
    name: 'Mock Claude Haiku',
    contextWindow: 200000,
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 0.75,
    capabilities: { text: true, streaming: true, json: true },
  },
];

export interface MockProviderOptions {
  slug?: string;
  name?: string;
  defaultModel?: string;
  models?: ProviderModelDescriptor[];
  responseText?: string;
  scenario?: MockScenario;
}

export class MockProvider implements LLMProvider {
  readonly id = 'mock';
  readonly slug: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  readonly defaultModel?: string;

  private readonly models: ProviderModelDescriptor[];
  private readonly responseText: string;
  private readonly scenario: MockScenario;

  constructor(options: MockProviderOptions = {}) {
    this.slug = options.slug ?? 'mock';
    this.name = options.name ?? 'Mock Provider';
    this.capabilities = defaultCapabilities;
    this.defaultModel = options.defaultModel ?? options.models?.[0]?.id ?? defaultModels[0].id;
    this.models = options.models ?? defaultModels;
    this.responseText =
      options.responseText ?? 'This is a mocked provider response for the requested prompt.';
    this.scenario = options.scenario ?? 'success';
  }

  listModels(): ProviderModelDescriptor[] {
    return [...this.models];
  }

  async generateText(request: GenerateTextRequest): Promise<ProviderResponse> {
    this.validateRequest(request);

    if (this.scenario === 'api_error') {
      throw new ProviderError(
        this.slug,
        'Mock provider returned an API error.',
        'PROVIDER_ERROR',
        false,
      );
    }
    if (this.scenario === 'rate_limit') {
      throw new ProviderError(this.slug, 'Mock provider rate limit exceeded.', 'RATE_LIMIT', true);
    }
    if (this.scenario === 'timeout') {
      throw new ProviderError(this.slug, 'Mock provider request timed out.', 'TIMEOUT', true);
    }

    const prompt = request.messages.at(-1)!.content;
    const model = request.model ?? this.defaultModel ?? this.models[0].id;
    const nextText =
      this.scenario === 'empty'
        ? ''
        : this.scenario === 'malformed'
          ? '{"status":"ok","response":'
          : `${this.responseText} Prompt: ${prompt}`;
    const text =
      this.scenario === 'malformed' || this.scenario === 'empty'
        ? nextText
        : this.scenario === 'json' || request.responseFormat === 'json'
          ? JSON.stringify({ status: 'ok', response: nextText })
          : nextText;
    const inputTokens = Math.max(1, prompt.split(/\s+/).filter(Boolean).length);
    const outputTokens = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;

    return {
      id: 'mock-completion',
      provider: this.slug,
      model,
      text,
      finishReason: 'stop',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      metadata: { source: 'mock', scenario: this.scenario },
    };
  }

  async *streamText(request: GenerateTextRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const payload = await this.generateText({ ...request, stream: false });
    const segments =
      payload.text.match(/.{1,24}/gs) ?? (payload.text.length > 0 ? [payload.text] : []);

    for (let index = 0; index < segments.length; index += 1) {
      const chunk = segments[index];
      yield {
        id: payload.id,
        provider: payload.provider,
        model: payload.model,
        delta: chunk,
        done: index === segments.length - 1,
        finishReason: index === segments.length - 1 ? payload.finishReason : undefined,
      };
    }

    if (segments.length === 0) {
      yield {
        id: payload.id,
        provider: payload.provider,
        model: payload.model,
        delta: '',
        done: true,
        finishReason: payload.finishReason,
      };
    }
  }

  private validateRequest(request: GenerateTextRequest): void {
    if (!request || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new ProviderError(
        this.slug,
        'At least one message is required.',
        'INVALID_REQUEST',
        false,
      );
    }
    if (
      request.messages.some(
        (message) =>
          !message ||
          typeof message.role !== 'string' ||
          !['system', 'user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string',
      )
    ) {
      throw new ProviderError(
        this.slug,
        'Each message must include a supported role and string content.',
        'INVALID_REQUEST',
        false,
      );
    }
    if (
      request.model !== undefined &&
      (typeof request.model !== 'string' || request.model.trim().length === 0)
    ) {
      throw new ProviderError(this.slug, 'Model cannot be empty.', 'INVALID_REQUEST', false);
    }
  }
}
