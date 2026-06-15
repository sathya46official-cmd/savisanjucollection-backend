import { queryAsUser } from '../config/database';

/**
 * Minimal shape of the authenticated actor (matches AuthRequest['user']).
 */
export interface AuditActor {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export interface AuditOptions {
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Record a privileged admin action in `admin_audit_log` (migration 010).
 *
 * This is BEST-EFFORT and MUST NEVER block or fail the main request:
 *   - it is fire-and-forget (callers do not await its result for correctness),
 *   - it swallows every error (logged server-side only),
 *   - it never throws.
 *
 * The insert runs through `queryAsUser(..., { isAdmin: true })` so that the
 * RLS `WITH CHECK (app_is_admin())` policy is satisfied when the backend
 * connects as the least-privilege `savisanju_app` role.
 */
export async function logAdminAction(
  actor: AuditActor | undefined,
  action: string,
  opts: AuditOptions = {}
): Promise<void> {
  try {
    if (!actor?.userId) {
      return;
    }

    await queryAsUser(
      actor.userId,
      `INSERT INTO admin_audit_log
         (actor_user_id, actor_email, action, target_type, target_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actor.userId,
        actor.email ?? null,
        action,
        opts.targetType ?? null,
        opts.targetId ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
        // `inet` accepts an IP string; null when unknown. Cast guards bad values.
        opts.ip ?? null
      ],
      { isAdmin: true }
    );
  } catch (error) {
    // Never let auditing break the request path.
    console.error('Audit log write failed (non-fatal):', error);
  }
}
