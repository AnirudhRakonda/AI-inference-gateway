import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running the admin seed.');
  }
  if (Array.from(password).length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: 'ADMIN' },
    update: { role: 'ADMIN', passwordHash },
  });
}

seedAdmin()
  .catch((error: unknown) => {
    console.error('Admin seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
