export type ProviderRole = 'system' | 'user' | 'assistant';

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
}

export interface ProviderCapabilities {
  text: boolean;
  streaming: boolean;
  json: boolean;
  tools: boolean;
  vision: boolean;
}

export interface ProviderModelDescriptor {
  id: string;
  name: string;
  contextWindow?: number;
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  capabilities?: Partial<ProviderCapabilities>;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateTextRequest {
  messages: ProviderMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProviderResponse {
  id: string;
  provider: string;
  model: string;
  text: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  usage: ProviderUsage;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  id: string;
  provider: string;
  model: string;
  delta: string;
  done: boolean;
  finishReason?: ProviderResponse['finishReason'];
}

export interface LLMProvider {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  readonly defaultModel?: string;
  listModels(): ProviderModelDescriptor[];
  generateText(request: GenerateTextRequest): Promise<ProviderResponse>;
  streamText(request: GenerateTextRequest): AsyncGenerator<StreamChunk, void, unknown>;
}
