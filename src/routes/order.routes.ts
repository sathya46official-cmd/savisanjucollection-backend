import { Router, Response } from 'express';
import pool, { queryAsUser } from '../config/database';
import { randomBytes } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate order ID in SAVI-XXXXXXXX format
function generateOrderId(): string {
  return 'SAVI-' + randomBytes(4).toString('hex').toUpperCase();
}

// Create order (requires authentication)
router.post('/create', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  // Normalize quantity up-front and validate it is a positive integer.
  const {
    variant_id,
    quantity = 1,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    country = 'India',
    phone,
  } = req.body;

  // Validation (each branch returns so execution cannot fall through)
  if (!variant_id || !address_line1 || !city || !state || !postal_code || !phone) {
    res.status(400).json({
      error: 'Missing required fields: variant_id, address_line1, city, state, postal_code, phone'
    });
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: 'quantity must be a positive integer' });
    return;
  }

  const userId = req.user!.userId;
  const orderId = generateOrderId();

  // Use a single transaction with a row-level lock so the stock check and the
  // decrement are atomic. Without this, two concurrent orders could both read
  // the same stock value, both pass the check, and oversell inventory
  // (the "unlimited inventory" race condition).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Set the RLS context for this transaction (see migration 009) so the
    // orders INSERT satisfies the ownership policy when running under the
    // least-privilege DB role.
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);

    // Lock the variant row FOR UPDATE; concurrent orders for the same variant
    // will serialize here until this transaction commits/rolls back.
    const variantResult = await client.query(
      'SELECT price, quantity AS stock FROM product_variants WHERE id = $1 FOR UPDATE',
      [variant_id]
    );

    if (variantResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Product variant not found' });
      return;
    }

    const variant = variantResult.rows[0];

    if (variant.stock < quantity) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    // Atomically decrement stock. The WHERE guard (quantity >= $2) is a second
    // line of defense in addition to the row lock and the CHECK(quantity >= 0).
    const decrementResult = await client.query(
      `UPDATE product_variants
       SET quantity = quantity - $2, updated_at = NOW()
       WHERE id = $1 AND quantity >= $2
       RETURNING quantity`,
      [variant_id, quantity]
    );

    if (decrementResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    // Create the order using the server-side price (never trust a client price).
    const result = await client.query(
      `INSERT INTO orders (
        order_id, user_id, variant_id, quantity, price,
        address_line1, address_line2, city, state, postal_code, country, phone,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        orderId,
        userId,
        variant_id,
        quantity,
        variant.price,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        phone,
        'pending'
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      order: result.rows[0],
      message: 'Order placed successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// Get order history (authenticated users only)
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const result = await queryAsUser(
      userId,
      `SELECT 
        o.*,
        pv.color as color_name, pv.image_url as product_image,
        p.name as product_name
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

// Cancel order (authenticated users only)
router.put('/:id/cancel', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if order belongs to user
    const orderCheck = await queryAsUser(
      userId,
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (orderCheck.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orderCheck.rows[0];

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      res.status(400).json({ 
        error: `Cannot cancel order with status: ${order.status}` 
      });
      return;
    }

    // Update order status
    const result = await queryAsUser(
      userId,
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['cancelled', id]
    );

    res.json({
      success: true,
      order: result.rows[0],
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
