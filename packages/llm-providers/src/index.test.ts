import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultProviderRegistry,
  MockProvider,
  OpenAICompatibleProvider,
  ProviderNotFoundError,
  ProviderRegistry,
} from './index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('provider registry', () => {
  it('registers and resolves providers by slug', () => {
    const registry = new ProviderRegistry();
    const provider = new MockProvider({ slug: 'mock', name: 'Mock Provider' });

    registry.register(provider);

    expect(registry.has('mock')).toBe(true);
    expect(registry.resolve('mock')).toBe(provider);
    expect(() => registry.resolve('unknown')).toThrow(ProviderNotFoundError);
  });

  it('starts in mock mode without a key and never makes an external LLM request', async () => {
    const previousMode = process.env.LLM_MODE;
    const previousApiKey = process.env.OPENAI_API_KEY;
    const previousScenario = process.env.LLM_MOCK_SCENARIO;
    delete process.env.LLM_MODE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_MOCK_SCENARIO;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    try {
      const registry = createDefaultProviderRegistry();

      expect(registry.get('mock')).toBeInstanceOf(MockProvider);
      expect(registry.list()).toHaveLength(1);

      const response = await registry.resolve('mock').generateText({
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(response.text).toContain('hello');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (previousMode === undefined) delete process.env.LLM_MODE;
      else process.env.LLM_MODE = previousMode;
      if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousApiKey;
      if (previousScenario === undefined) delete process.env.LLM_MOCK_SCENARIO;
      else process.env.LLM_MOCK_SCENARIO = previousScenario;
    }
  });

  it('supports mock generation and streaming', async () => {
    const provider = new MockProvider({ slug: 'mock' });
    const response = await provider.generateText({
      messages: [{ role: 'user', content: 'hello world' }],
      model: 'mock-gpt-4o-mini',
    });

    expect(response.provider).toBe('mock');
    expect(response.text).toContain('hello world');

    const stream = provider.streamText({
      messages: [{ role: 'user', content: 'hello world' }],
    });

    const chunks = [] as Array<{ delta: string; done: boolean }>;
    for await (const chunk of stream) {
      chunks.push({ delta: chunk.delta, done: chunk.done });
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('returns deterministic valid JSON in the JSON scenario', async () => {
    const provider = createDefaultProviderRegistry({
      mode: 'mock',
      mockScenario: 'json',
    }).resolve('mock');
    const request = { messages: [{ role: 'user' as const, content: 'status?' }] };
    const first = await provider.generateText(request);
    const second = await provider.generateText(request);

    expect(JSON.parse(first.text)).toEqual({
      status: 'ok',
      response: 'This is a mocked provider response for the requested prompt. Prompt: status?',
    });
    expect(second).toEqual(first);
  });

  it('supports a configured deterministic mock response', async () => {
    const provider = createDefaultProviderRegistry({
      mode: 'mock',
      mockResponse: 'Configured test output.',
    }).resolve('mock');
    const response = await provider.generateText({
      messages: [{ role: 'user', content: 'prompt' }],
    });

    expect(response.text).toBe('Configured test output. Prompt: prompt');
  });

  it.each([
    ['empty', ''],
    ['malformed', '{"status":"ok","response":'],
  ] as const)('returns the configured %s response scenario', async (scenario, expectedText) => {
    const provider = new MockProvider({ scenario });
    const response = await provider.generateText({
      messages: [{ role: 'user', content: 'test' }],
      responseFormat: 'json',
    });

    expect(response.text).toBe(expectedText);
  });

  it.each([
    ['api_error', 'PROVIDER_ERROR', false],
    ['rate_limit', 'RATE_LIMIT', true],
    ['timeout', 'TIMEOUT', true],
  ] as const)('reports %s with its retryability', async (scenario, code, retryable) => {
    const provider = new MockProvider({ scenario });
    await expect(
      provider.generateText({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toMatchObject({ code, retryable });
  });

  it.each([
    ['missing messages', { messages: [] }],
    ['missing content', { messages: [{ role: 'user' }] }],
  ])('rejects invalid input with a typed error (%s)', async (_label, request) => {
    const provider = new MockProvider();
    await expect(
      provider.generateText(request as Parameters<typeof provider.generateText>[0]),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('requires an API key for OpenAI compatible providers', async () => {
    expect(() => createDefaultProviderRegistry({ mode: 'real', apiKey: '' })).toThrow(
      /OPENAI_API_KEY is required/,
    );
  });

  it('keeps the OpenAI-compatible provider in real mode', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'real provider response' } }],
            usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const registry = createDefaultProviderRegistry({
      mode: 'real',
      apiKey: 'test-key',
      baseUrl: 'https://provider.test/v1',
    });
    expect(registry.get('openai')).toBeInstanceOf(OpenAICompatibleProvider);
    expect(registry.has('mock')).toBe(false);

    const result = await registry.resolve('openai').generateText({
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result.text).toBe('real provider response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown LLM modes rather than silently choosing a provider', () => {
    const previousMode = process.env.LLM_MODE;
    process.env.LLM_MODE = 'other';
    try {
      expect(() => createDefaultProviderRegistry()).toThrow(/Invalid LLM_MODE/);
    } finally {
      if (previousMode === undefined) delete process.env.LLM_MODE;
      else process.env.LLM_MODE = previousMode;
    }
  });
});
