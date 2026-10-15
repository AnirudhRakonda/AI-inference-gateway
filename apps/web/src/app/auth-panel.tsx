'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type User = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
};

type AuthMode = 'login' | 'register';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch {
    return `Request failed with HTTP ${response.status}.`;
  }
  return `Request failed with HTTP ${response.status}.`;
}

export default function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, { credentials: 'include' });
      if (!response.ok) {
        setUser(null);
        setUsers([]);
        return;
      }

      const result: { user: User } = await response.json();
      setUser(result.user);
      if (result.user.role === 'ADMIN') {
        const adminResponse = await fetch(`${apiUrl}/admin/users`, { credentials: 'include' });
        if (!adminResponse.ok) {
          throw new Error(await readError(adminResponse));
        }
        const adminResult: { users: User[] } = await adminResponse.json();
        setUsers(adminResult.users);
      } else {
        setUsers([]);
      }
    } catch (error) {
      setUser(null);
      setUsers([]);
      setMessage(error instanceof Error ? error.message : 'Could not check the current session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(`${apiUrl}/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      });
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }

      const result: { user: User } = await response.json();
      setUser(result.user);
      setUsers([]);
      setMessage(
        mode === 'register' ? 'Account created and signed in.' : 'Signed in successfully.',
      );
      form.reset();
      await refreshSession();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not reach the authentication service.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
      setUser(null);
      setUsers([]);
      setMessage('Signed out.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not reach the authentication service.',
      );
    }
  }

  return (
    <section aria-labelledby="account-title" className="mt-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Chapter 1 · Authentication
          </p>
          <h2 id="account-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Account access
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Passwords are hashed; sessions use an HTTP-only cookie.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-600">Checking your session…</p>
          ) : user ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Signed in as</p>
                  <p className="mt-1 break-all text-lg font-semibold text-slate-950">
                    {user.email}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    user.role === 'ADMIN'
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <p className="mt-4 text-sm text-emerald-700">
                Protected session verified by the API.
              </p>
              <button
                type="button"
                onClick={signOut}
                className="mt-5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                {(['login', 'register'] as const).map((authMode) => (
                  <button
                    key={authMode}
                    type="button"
                    onClick={() => {
                      setMode(authMode);
                      setMessage('');
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize ${
                      mode === authMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {authMode === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
              <form onSubmit={submitCredentials} className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Email
                  <input
                    required
                    autoComplete="email"
                    type="email"
                    name="email"
                    maxLength={254}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                  <input
                    required
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    type="password"
                    name="password"
                    minLength={mode === 'register' ? 12 : 1}
                    maxLength={72}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                  {mode === 'register' && (
                    <span className="mt-1 block text-xs text-slate-500">
                      Use at least 12 characters and no more than 72 UTF-8 bytes.
                    </span>
                  )}
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
                </button>
              </form>
            </>
          )}
          {message && (
            <p
              aria-live="polite"
              className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700"
            >
              {message}
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Role-based access control</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">Admin route</h3>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                user?.role === 'ADMIN'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {user?.role === 'ADMIN' ? 'Access granted' : 'Admin only'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in to verify your protected session. Administrators can view the registered-user
            list; standard users are denied by the API.
          </p>
          {user?.role === 'ADMIN' && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>Registered users</span>
                <span>{users.length}</span>
              </div>
              <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                {users.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="truncate text-slate-700">{account.email}</span>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                      {account.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!user && !loading && (
            <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Sign in to test a protected route. Register a standard account, or seed an admin to
              test administrator access.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
