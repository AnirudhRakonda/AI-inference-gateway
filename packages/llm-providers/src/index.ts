export * from './errors.js';
export * from './registry.js';
export * from './types.js';
export * from './providers/mock.js';
export * from './providers/openai.js';

import { MockProvider, type MockScenario } from './providers/mock.js';
import { OpenAICompatibleProvider } from './providers/openai.js';
import { ProviderRegistry } from './registry.js';

export type LLMMode = 'mock' | 'real';

export interface ProviderRegistryOptions {
  mode?: LLMMode;
  apiKey?: string;
  baseUrl?: string;
  openAiName?: string;
  mockResponse?: string;
  mockScenario?: MockScenario;
}

const supportedMockScenarios = [
  'success',
  'json',
  'empty',
  'malformed',
  'api_error',
  'rate_limit',
  'timeout',
] as const satisfies readonly MockScenario[];

export function createDefaultProviderRegistry(
  options: ProviderRegistryOptions = {},
): ProviderRegistry {
  const configuredMode = options.mode ?? process.env.LLM_MODE ?? 'mock';
  if (configuredMode !== 'mock' && configuredMode !== 'real') {
    throw new Error(`Invalid LLM_MODE "${configuredMode}". Expected "mock" or "real".`);
  }

  const registry = new ProviderRegistry();

  if (configuredMode === 'mock') {
    registry.register(
      new MockProvider({
        slug: 'mock',
        name: 'Mock Provider',
        responseText: options.mockResponse ?? process.env.LLM_MOCK_RESPONSE,
        scenario: options.mockScenario ?? getMockScenarioFromEnvironment(),
      }),
    );
    return registry;
  }

  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_MODE=real.');
  }

  registry.register(
    new OpenAICompatibleProvider({
      slug: 'openai',
      name: options.openAiName ?? 'OpenAI Compatible',
      apiKey,
      baseUrl: options.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    }),
  );
  return registry;
}

function getMockScenarioFromEnvironment(): MockScenario {
  const scenario = process.env.LLM_MOCK_SCENARIO ?? 'success';
  if (!supportedMockScenarios.some((supported) => supported === scenario)) {
    throw new Error(`Invalid LLM_MOCK_SCENARIO "${scenario}".`);
  }
  return scenario as MockScenario;
}
