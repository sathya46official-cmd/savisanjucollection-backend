import { Pool, PoolClient } from 'pg';

// Fail fast in production rather than silently falling back to a weak default password.
if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
  throw new Error('FATAL: DB_PASSWORD environment variable must be set in production');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'savisanju',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: parseInt(process.env.DB_POOL_MAX || '10'), // Keep modest for a 1 vCPU / 2 GB server
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    // Only log queries in development — never in production (security + performance)
    if (process.env.NODE_ENV !== 'production') {
      const duration = Date.now() - start;
      console.log('Executed query', { duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

/**
 * Run a query with the per-request RLS context set (see migration 009).
 *
 * The existing `WHERE user_id = ...` clauses remain the primary row filter; this
 * sets `app.current_user_id` (and optionally `app.is_admin`) inside a transaction
 * so the Row Level Security policies enforce ownership defensively when the
 * backend connects as the least-privilege `savisanju_app` role. Under a superuser
 * connection RLS is bypassed and this behaves exactly like a normal query.
 */
export const queryAsUser = async (
  userId: string | null,
  text: string,
  params?: any[],
  options?: { isAdmin?: boolean }
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId ?? '']);
    if (options?.isAdmin) {
      await client.query("SELECT set_config('app.is_admin', 'on', true)");
    }
    const res = await client.query(text, params);
    await client.query('COMMIT');
    return res;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Database query error (queryAsUser):', error);
    throw error;
  } finally {
    client.release();
  }
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
