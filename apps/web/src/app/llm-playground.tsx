'use client';

import { FormEvent, useState } from 'react';

type Scenario = 'success' | 'json' | 'empty' | 'malformed' | 'api_error' | 'rate_limit' | 'timeout';

type PlaygroundResult = {
  provider?: string;
  model?: string;
  text: string;
  finishReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  scenario?: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const error = body.error;
      if (typeof error === 'string') {
        const code = 'code' in body && typeof body.code === 'string' ? ` (${body.code})` : '';
        return `${error}${code}`;
      }
    }
  } catch {
    return `Request failed with HTTP ${response.status}.`;
  }
  return `Request failed with HTTP ${response.status}.`;
}

export default function LlmPlayground() {
  const [prompt, setPrompt] = useState('Say hello in one sentence.');
  const [scenario, setScenario] = useState<Scenario>('success');
  const [responseFormat, setResponseFormat] = useState<'text' | 'json'>('text');
  const [stream, setStream] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${apiUrl}/admin/llm-playground`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, scenario, responseFormat, stream }),
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      if (stream) {
        if (!response.body) {
          throw new Error('Streaming response body was unavailable.');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = '';
        let streamedText = '';
        let streamInfo: Partial<PlaygroundResult> = {};

        while (true) {
          const { value, done } = await reader.read();
          buffered += decoder.decode(value, { stream: !done });
          const lines = buffered.split('\n');
          buffered = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            const chunk: {
              provider: string;
              model: string;
              delta: string;
              finishReason?: string;
            } = JSON.parse(line);
            streamedText += chunk.delta;
            streamInfo = {
              provider: chunk.provider,
              model: chunk.model,
              finishReason: chunk.finishReason,
            };
            setResult({ ...streamInfo, text: streamedText, scenario });
          }

          if (done) break;
        }

        if (buffered.trim()) {
          throw new Error('Streaming response ended with an incomplete chunk.');
        }
        return;
      }

      const payload: PlaygroundResult = await response.json();
      setResult(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not run mock request.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="llm-playground-title" className="mt-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">
            Chapter 3 · Mock provider
          </p>
          <h2
            id="llm-playground-title"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-950"
          >
            LLM playground
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Mock only · no provider key used
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">
            Prompt
            <textarea
              required
              maxLength={12000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={7}
              className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Mock scenario
              <select
                value={scenario}
                onChange={(event) => setScenario(event.target.value as Scenario)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                <option value="success">Successful text</option>
                <option value="json">Valid JSON response</option>
                <option value="empty">Empty response</option>
                <option value="malformed">Malformed response</option>
                <option value="api_error">API error</option>
                <option value="rate_limit">Rate limit</option>
                <option value="timeout">Timeout</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Format
              <select
                value={responseFormat}
                onChange={(event) => setResponseFormat(event.target.value as 'text' | 'json')}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                <option value="text">Plain text</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={stream}
              onChange={(event) => setStream(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            Stream response chunks
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Running mock…' : 'Run mock request'}
          </button>
        </form>

        <article
          aria-live="polite"
          className="min-h-72 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <h3 className="font-semibold">Response</h3>
            {result && (
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-emerald-300">
                {result.provider ?? 'mock'} · {result.model ?? 'mock-gpt-4o-mini'}
              </span>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-900 bg-rose-950/60 p-3 text-sm text-rose-200">
              {error}
            </p>
          ) : result ? (
            <>
              <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6">
                {result.text || '(empty response)'}
              </pre>
              {result.usage && (
                <p className="mt-4 border-t border-slate-700 pt-3 text-xs text-slate-400">
                  Tokens: {result.usage.inputTokens} in · {result.usage.outputTokens} out ·{' '}
                  {result.usage.totalTokens} total
                </p>
              )}
              {result.finishReason && (
                <p className="mt-1 text-xs text-slate-500">Finish reason: {result.finishReason}</p>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              Choose a scenario and run it to inspect the mock output here.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
