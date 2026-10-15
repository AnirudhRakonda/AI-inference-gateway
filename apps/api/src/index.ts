import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const prisma = new PrismaClient();
const sessionCookie = 'gateway_session';
const developmentJwtSecret = 'local-development-secret-do-not-use-in-production';
const sessionLifetimeSeconds = 60 * 60;

const healthCheckSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
});

const entityNames = [
  'users',
  'providers',
  'models',
  'conversations',
  'messages',
  'usageRecords',
] as const;

export type EntityCounts = Record<(typeof entityNames)[number], number>;

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
}

export type PublicUser = Omit<UserAccount, 'passwordHash'>;

export interface AppDependencies {
  checkDatabase(): Promise<void>;
  getEntityCounts(): Promise<EntityCounts>;
  createUser(input: { email: string; passwordHash: string }): Promise<UserAccount>;
  findUserByEmail(email: string): Promise<UserAccount | null>;
  findUserById(id: string): Promise<PublicUser | null>;
  listUsers(): Promise<PublicUser[]>;
}

const databaseDependencies: AppDependencies = {
  checkDatabase: async () => {
    await prisma.$connect();
  },
  getEntityCounts: async () => {
    const [users, providers, models, conversations, messages, usageRecords] = await Promise.all([
      prisma.user.count(),
      prisma.provider.count(),
      prisma.model.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.usage.count(),
    ]);

    return { users, providers, models, conversations, messages, usageRecords };
  },
  createUser: (input) =>
    prisma.user.create({
      data: input,
      select: { id: true, email: true, passwordHash: true, role: true, createdAt: true },
    }),
  findUserByEmail: (email) =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, createdAt: true },
    }),
  findUserById: (id) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, createdAt: true },
    }),
  listUsers: () =>
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, email: true, role: true, createdAt: true },
    }),
};

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(72, 'Password must be no more than 72 characters.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password must not exceed 72 UTF-8 bytes.',
  });

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: passwordSchema,
});

const registrationSchema = credentialsSchema.strict();
const loginSchema = credentialsSchema.strict();

function publicUser(user: UserAccount): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionLifetimeSeconds,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export function createApp(dependencies: AppDependencies = databaseDependencies) {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.register(cookie);
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? developmentJwtSecret,
    cookie: { cookieName: sessionCookie, signed: false },
    sign: { expiresIn: sessionLifetimeSeconds },
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
  }));

  app.get('/ready', async (_request, reply) => {
    try {
      await dependencies.checkDatabase();
      return {
        ...healthCheckSchema.parse({ status: 'ok', service: 'api' }),
        dependencies: { database: 'connected' },
      };
    } catch (error) {
      app.log.error({ err: error }, 'Database readiness check failed');
      return reply.code(503).send({
        status: 'error',
        service: 'api',
        dependencies: { database: 'unavailable' },
      });
    }
  });

  app.get('/system/status', async (_request, reply) => {
    try {
      await dependencies.checkDatabase();
      const entities = await dependencies.getEntityCounts();
      return {
        status: 'ok',
        service: 'api',
        database: 'connected',
        entities,
      };
    } catch (error) {
      app.log.error({ err: error }, 'System status check failed');
      return reply.code(503).send({
        status: 'error',
        service: 'api',
        database: 'unavailable',
        entities: null,
      });
    }
  });

  app.post('/auth/register', async (request, reply) => {
    const result = registrationSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Invalid registration details.',
        details: result.error.flatten().fieldErrors,
      });
    }

    const passwordHash = await bcrypt.hash(result.data.password, 12);
    try {
      const user = await dependencies.createUser({
        email: result.data.email,
        passwordHash,
      });
      const token = await reply.jwtSign({ sub: user.id });
      reply.setCookie(sessionCookie, token, cookieOptions());
      return reply.code(201).send({ user: publicUser(user) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.code(409).send({ error: 'An account with this email already exists.' });
      }
      app.log.error({ err: error }, 'User registration failed');
      return reply.code(500).send({ error: 'Could not create the account.' });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: 'Invalid login details.',
        details: result.error.flatten().fieldErrors,
      });
    }

    const user = await dependencies.findUserByEmail(result.data.email);
    if (!user || !(await bcrypt.compare(result.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Email or password is incorrect.' });
    }

    const token = await reply.jwtSign({ sub: user.id });
    reply.setCookie(sessionCookie, token, cookieOptions());
    return { user: publicUser(user) };
  });

  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(sessionCookie, { path: '/' });
    return { status: 'ok' };
  });

  app.get('/auth/me', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const user = await dependencies.findUserById(request.user.sub);
    if (!user) {
      reply.clearCookie(sessionCookie, { path: '/' });
      return reply.code(401).send({ error: 'Authentication required.' });
    }
    return { user };
  });

  app.get('/admin/users', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const user = await dependencies.findUserById(request.user.sub);
    if (!user) {
      reply.clearCookie(sessionCookie, { path: '/' });
      return reply.code(401).send({ error: 'Authentication required.' });
    }
    if (user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Administrator access required.' });
    }
    return { users: await dependencies.listUsers() };
  });

  return app;
}

export const app = createApp();

export async function startServer() {
  try {
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
    }
    const port = Number(process.env.PORT ?? 4000);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`API listening on http://0.0.0.0:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  void startServer();
}
