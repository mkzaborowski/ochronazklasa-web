// Create (or promote) an ADMIN user with an email + password.
// Usage: npm run create-admin -- <email> <password> "<name>"
// Requires DATABASE_URL (loaded from .env via --env-file in the npm script).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> "<name>"');
  process.exit(1);
}

const db = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", active: true },
    create: { email, name: name ?? email, passwordHash, role: "ADMIN", active: true },
  });
  console.log(`✓ ADMIN ready: ${user.email} (id: ${user.id})`);
} catch (err) {
  console.error("Failed to create admin:", err.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
