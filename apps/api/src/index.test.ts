import { afterAll, describe, expect, it } from 'vitest';
import {
  app,
  createApp,
  type AppDependencies,
  type PublicUser,
  type StatusDependencies,
  type UserAccount,
} from './index';

describe('API health routes', () => {
  afterAll(async () => {
    await app.close();
  });

  const healthyDatabase: StatusDependencies = {
    checkDatabase: async () => undefined,
    getEntityCounts: async () => ({
      users: 2,
      providers: 3,
      models: 4,
      conversations: 5,
      messages: 6,
      usageRecords: 7,
    }),
  };

  function createAuthDependencies() {
    const users = new Map<string, UserAccount>();
    const dependencies: AppDependencies = {
      ...healthyDatabase,
      createUser: async ({ email, passwordHash }) => {
        const user = {
          id: 'user-1',
          email,
          passwordHash,
          role: 'USER',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        };
        users.set(user.id, user);
        return user;
      },
      findUserByEmail: async (email) =>
        [...users.values()].find((user) => user.email === email) ?? null,
      findUserById: async (id): Promise<PublicUser | null> => {
        const user = users.get(id);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        };
      },
      listUsers: async () =>
        [...users.values()].map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
    };
    return { dependencies, users };
  }

  it('returns the health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'api',
    });
  });

  it('reports the database as ready when it is reachable', async () => {
    const testApp = createApp(healthyDatabase);
    const response = await testApp.inject({ method: 'GET', url: '/ready' });
    await testApp.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'api',
      dependencies: { database: 'connected' },
    });
  });

  it('returns an unavailable status when the database cannot be reached', async () => {
    const testApp = createApp({
      ...healthyDatabase,
      checkDatabase: async () => {
        throw new Error('database unavailable');
      },
    });
    const response = await testApp.inject({ method: 'GET', url: '/ready' });
    await testApp.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'error',
      service: 'api',
      dependencies: { database: 'unavailable' },
    });
  });

  it('returns persisted entity counts for the dashboard', async () => {
    const testApp = createApp(healthyDatabase);
    const response = await testApp.inject({ method: 'GET', url: '/system/status' });
    await testApp.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'api',
      database: 'connected',
      entities: {
        users: 2,
        providers: 3,
        models: 4,
        conversations: 5,
        messages: 6,
        usageRecords: 7,
      },
    });
  });

  it('registers users with a protected session and does not return password hashes', async () => {
    const testApp = createApp(createAuthDependencies().dependencies);
    const response = await testApp.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: ' Person@Example.com ', password: 'long-enough-password' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().user).toMatchObject({
      id: 'user-1',
      email: 'person@example.com',
      role: 'USER',
    });
    expect(response.json().user).not.toHaveProperty('passwordHash');
    expect(response.headers['set-cookie']).toContain('HttpOnly');

    const cookie = response.headers['set-cookie']?.split(';')[0];
    const session = await testApp.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().user.email).toBe('person@example.com');
    await testApp.close();
  });

  it('rejects weak passwords and checks credentials on login', async () => {
    const testApp = createApp(createAuthDependencies().dependencies);
    const invalidRegistration = await testApp.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'user@example.com', password: 'short' },
    });
    expect(invalidRegistration.statusCode).toBe(400);

    await testApp.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'user@example.com', password: 'long-enough-password' },
    });
    const invalidLogin = await testApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'user@example.com', password: 'wrong-password' },
    });
    expect(invalidLogin.statusCode).toBe(401);

    const login = await testApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: ' USER@example.com ', password: 'long-enough-password' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    await testApp.close();
  });

  it('rejects unauthenticated and non-admin access to protected admin routes', async () => {
    const testApp = createApp(createAuthDependencies().dependencies);
    const unauthorized = await testApp.inject({ method: 'GET', url: '/admin/users' });
    expect(unauthorized.statusCode).toBe(401);

    const registration = await testApp.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'user@example.com', password: 'long-enough-password' },
    });
    const cookie = registration.headers['set-cookie']?.split(';')[0];
    const forbidden = await testApp.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { cookie },
    });
    expect(forbidden.statusCode).toBe(403);
    await testApp.close();
  });

  it('allows seeded administrators to access user management', async () => {
    const auth = createAuthDependencies();
    const testApp = createApp(auth.dependencies);
    await testApp.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'admin@example.com', password: 'long-enough-password' },
    });
    auth.users.get('user-1')!.role = 'ADMIN';
    const login = await testApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@example.com', password: 'long-enough-password' },
    });
    const cookie = login.headers['set-cookie']?.split(';')[0];
    const response = await testApp.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().users).toHaveLength(1);
    expect(response.json().users[0]).not.toHaveProperty('passwordHash');
    await testApp.close();
  });
});
