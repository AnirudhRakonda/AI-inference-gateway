import { ProviderError } from '../errors.js';
import type { GenerateTextRequest, LLMProvider, ProviderCapabilities, ProviderModelDescriptor, ProviderResponse, StreamChunk } from '../types.js';

const defaultCapabilities: ProviderCapabilities = {
  text: true,
  streaming: true,
  json: true,
  tools: true,
  vision: false,
};

const defaultModels: ProviderModelDescriptor[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextWindow: 128000,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    capabilities: { text: true, streaming: true, json: true, tools: true },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 15.0,
    capabilities: { text: true, streaming: true, json: true, tools: true },
  },
];

export interface OpenAICompatibleProviderOptions {
  slug?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  models?: ProviderModelDescriptor[];
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id = 'openai-compatible';
  readonly slug: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  readonly defaultModel?: string;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly models: ProviderModelDescriptor[];

  constructor(options: OpenAICompatibleProviderOptions = {}) {
    this.slug = options.slug ?? 'openai';
    this.name = options.name ?? 'OpenAI Compatible';
    this.capabilities = defaultCapabilities;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.defaultModel = options.defaultModel ?? options.models?.[0]?.id ?? defaultModels[0].id;
    this.models = options.models ?? defaultModels;
  }

  listModels(): ProviderModelDescriptor[] {
    return [...this.models];
  }

  async generateText(request: GenerateTextRequest): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new ProviderError(this.slug, 'An API key is required to call the OpenAI-compatible provider.', 'MISSING_API_KEY', false);
    }

    const model = request.model ?? this.defaultModel ?? this.models[0].id;
    const payload = {
      model,
      messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderError(this.slug, `OpenAI provider request failed: ${errorText}`, 'HTTP_ERROR', true);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const message = json.choices?.[0]?.message?.content ?? '';

    return {
      id: `openai-${Date.now()}`,
      provider: this.slug,
      model,
      text: message,
      finishReason: 'stop',
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? 0,
      },
      metadata: { baseUrl: this.baseUrl },
    };
  }

  async *streamText(request: GenerateTextRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const payload = await this.generateText({ ...request, stream: false });
    const chunks = payload.text.match(/.{1,32}/g) ?? [payload.text];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      yield {
        id: payload.id,
        provider: payload.provider,
        model: payload.model,
        delta: chunk,
        done: index === chunks.length - 1,
        finishReason: index === chunks.length - 1 ? payload.finishReason : undefined,
      };
    }
  }
}
