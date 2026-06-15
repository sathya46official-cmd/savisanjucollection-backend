/**
 * Secure admin bootstrap script.
 *
 * Creates (or promotes) an admin account using credentials supplied via
 * environment variables. This replaces the previous insecure pattern of seeding
 * a hardcoded admin (with a known password hash) directly in a SQL migration.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-password>' ADMIN_NAME='Admin' \
 *     npx tsx scripts/create-admin.ts
 *
 * Notes:
 *   - The password is read from the environment and hashed with bcrypt; it is
 *     never written to source control.
 *   - Requires migration 008_add_user_roles.sql to have been applied (role column).
 *   - Idempotent: running again updates the password and ensures role='admin'.
 */
import 'dotenv/config';
import { hashPassword, validatePasswordStrength } from '../src/utils/password';
import pool, { transaction } from '../src/config/database';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!email || !password) {
    console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    console.error("Example: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Str0ng!Pass' npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    console.error(`ERROR: "${email}" is not a valid email address.`);
    process.exit(1);
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    console.error('ERROR: Admin password does not meet strength requirements:');
    strength.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  await transaction(async (client) => {
    // Upsert the profile and force role='admin'.
    const profileResult = await client.query(
      `INSERT INTO user_profiles (email, name, email_verified, role)
       VALUES ($1, $2, TRUE, 'admin')
       ON CONFLICT (email)
       DO UPDATE SET role = 'admin', name = EXCLUDED.name, email_verified = TRUE
       RETURNING id`,
      [email, name]
    );

    const userId = profileResult.rows[0].id;

    // Upsert the auth record with the freshly generated bcrypt hash.
    await client.query(
      `INSERT INTO user_auth (user_id, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
      [userId, passwordHash]
    );
  });

  console.log(`✅ Admin account ready for ${email} (role=admin).`);
}

main()
  .catch((err) => {
    console.error('Failed to create admin:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
