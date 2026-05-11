import { Router, Response } from 'express';
import pool from '../config/database';
import { randomBytes } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate order ID in SAVI-XXXXXXXX format
function generateOrderId(): string {
  return 'SAVI-' + randomBytes(4).toString('hex').toUpperCase();
}

// Create order (requires authentication)
router.post('/create', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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

    // Validation
    if (!variant_id || !address_line1 || !city || !state || !postal_code || !phone) {
      res.status(400).json({ 
        error: 'Missing required fields: variant_id, address_line1, city, state, postal_code, phone' 
      });
    }

    // Get variant details to get price
    const variantResult = await pool.query(
      'SELECT price, quantity as stock FROM product_variants WHERE id = $1',
      [variant_id]
    );

    if (variantResult.rows.length === 0) {
      res.status(404).json({ error: 'Product variant not found' });
    }

    const variant = variantResult.rows[0];

    // Check stock
    if (variant.stock < quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
    }

    const orderId = generateOrderId();
    const userId = req.user!.userId; // Get authenticated user ID

    // Create order
    const result = await pool.query(
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

    res.status(201).json({
      success: true,
      order: result.rows[0],
      message: 'Order placed successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get order history (authenticated users only)
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const result = await pool.query(
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
    const orderCheck = await pool.query(
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
    const result = await pool.query(
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
