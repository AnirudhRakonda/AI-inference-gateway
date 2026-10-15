import AuthPanel from './auth-panel';

type ServiceState = {
  healthy: boolean;
  message: string;
};

type DashboardCounts = {
  users: number;
  providers: number;
  models: number;
  conversations: number;
  messages: number;
  usageRecords: number;
};

type SystemStatus = {
  database: ServiceState;
  counts: DashboardCounts | null;
};

async function fetchService(url: string, service: string): Promise<ServiceState> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return { healthy: false, message: `Endpoint returned HTTP ${response.status}.` };
    }

    const result: unknown = await response.json();
    if (
      typeof result === 'object' &&
      result !== null &&
      'status' in result &&
      result.status === 'ok' &&
      'service' in result &&
      result.service === service
    ) {
      return { healthy: true, message: 'Responding normally.' };
    }
    return { healthy: false, message: 'Endpoint returned an unexpected health response.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error.';
    return { healthy: false, message: `Could not reach service: ${message}` };
  }
}

function isDashboardCounts(value: unknown): value is DashboardCounts {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['users', 'providers', 'models', 'conversations', 'messages', 'usageRecords'].every(
      (key) => key in value && Number.isSafeInteger(value[key as keyof typeof value]),
    )
  );
}

async function fetchSystemStatus(url: string): Promise<SystemStatus> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    const result: unknown = await response.json();
    if (
      typeof result === 'object' &&
      result !== null &&
      'database' in result &&
      result.database === 'connected' &&
      'entities' in result &&
      isDashboardCounts(result.entities)
    ) {
      return {
        database: {
          healthy: response.ok,
          message: response.ok ? 'Connected.' : `HTTP ${response.status}.`,
        },
        counts: response.ok ? result.entities : null,
      };
    }
    return {
      database: {
        healthy: false,
        message: response.ok
          ? 'Database status was not available.'
          : `API returned HTTP ${response.status}.`,
      },
      counts: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error.';
    return {
      database: { healthy: false, message: `Could not read database status: ${message}` },
      counts: null,
    };
  }
}

function StatusCard({
  name,
  description,
  state,
}: {
  name: string;
  description: string;
  state: ServiceState;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{description}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{name}</h2>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            state.healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${state.healthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          {state.healthy ? 'Operational' : 'Unavailable'}
        </span>
      </div>
      <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">{state.message}</p>
    </article>
  );
}

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const apiUrl =
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const aiServiceUrl =
    process.env.AI_SERVICE_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_AI_SERVICE_URL ??
    'http://localhost:8000';

  const [api, aiService, system] = await Promise.all([
    fetchService(`${apiUrl}/health`, 'api'),
    fetchService(`${aiServiceUrl}/ready`, 'ai-service'),
    fetchSystemStatus(`${apiUrl}/system/status`),
  ]);
  const database = system.database;
  const allHealthy = api.healthy && aiService.healthy && database.healthy;
  const updatedAt = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  const counts = [
    { label: 'Users', value: system.counts?.users },
    { label: 'Providers', value: system.counts?.providers },
    { label: 'Models', value: system.counts?.models },
    { label: 'Conversations', value: system.counts?.conversations },
    { label: 'Messages', value: system.counts?.messages },
    { label: 'Usage records', value: system.counts?.usageRecords },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
              AI Inference Gateway
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              System health
            </h1>
            <p className="mt-2 text-slate-600">
              Live service checks and persisted data from the Chapter 2 database schema.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Refresh status
            <span aria-hidden="true">↻</span>
          </a>
        </header>

        <section
          aria-live="polite"
          className={`mt-8 flex flex-col gap-2 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
            allHealthy ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div>
            <p className="font-semibold text-slate-950">
              {allHealthy
                ? 'All checked systems are operational'
                : 'One or more checks need attention'}
            </p>
            <p className="mt-1 text-sm text-slate-600">Status checked {updatedAt}</p>
          </div>
          <span className="text-sm font-medium text-slate-600">Checks run on page load</span>
        </section>

        <section aria-label="Service health" className="mt-6 grid gap-4 md:grid-cols-3">
          <StatusCard name="API" description="Fastify backend" state={api} />
          <StatusCard name="PostgreSQL" description="Database connection" state={database} />
          <StatusCard name="AI service" description="FastAPI backend" state={aiService} />
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Database overview
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Schema records
              </h2>
            </div>
            <p className="text-sm text-slate-500">Live row counts from PostgreSQL</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {counts.map((item) => (
              <article
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-950">
                  {item.value ?? '—'}
                </p>
              </article>
            ))}
          </div>
          {!system.counts && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Database counts are unavailable until PostgreSQL is reachable and the Chapter 2
              migration has been applied.
            </p>
          )}
        </section>

        <AuthPanel />
      </div>
    </main>
  );
}
