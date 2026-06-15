import { Router, Response } from 'express';
import pool, { queryAsUser } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// GET /api/cart - Get user's cart with product details
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const result = await queryAsUser(
      userId,
      `SELECT 
        ci.id,
        ci.variant_id,
        ci.quantity,
        pv.color as color_name,
        pv.image_url as product_image,
        pv.price,
        pv.quantity as stock,
        p.name as product_name
      FROM cart_items ci
      JOIN product_variants pv ON ci.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC`,
      [userId]
    );

    const items = result.rows;
    const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    res.json({ items, total, count: items.length });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// POST /api/cart/add - Add item to cart
router.post('/add', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { variant_id, quantity = 1 } = req.body;

    if (!variant_id) {
      res.status(400).json({ error: 'variant_id is required' });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }

    // Check variant exists and has enough stock
    const variantResult = await pool.query(
      'SELECT quantity as stock FROM product_variants WHERE id = $1',
      [variant_id]
    );

    if (variantResult.rows.length === 0) {
      res.status(404).json({ error: 'Product variant not found' });
      return;
    }

    if (variantResult.rows[0].stock < quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    // Upsert: add or increment quantity
    const result = await queryAsUser(
      userId,
      `INSERT INTO cart_items (user_id, variant_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, variant_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
       RETURNING *`,
      [userId, variant_id, quantity]
    );

    res.status(201).json({ success: true, item: result.rows[0], message: 'Item added to cart' });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// PUT /api/cart/update - Set exact quantity for a cart item
router.put('/update', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { variant_id, quantity } = req.body;

    if (!variant_id || quantity === undefined) {
      res.status(400).json({ error: 'variant_id and quantity are required' });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1. Use /remove to delete.' });
      return;
    }

    // Check stock
    const variantResult = await pool.query(
      'SELECT quantity as stock FROM product_variants WHERE id = $1',
      [variant_id]
    );

    if (variantResult.rows.length === 0) {
      res.status(404).json({ error: 'Product variant not found' });
      return;
    }

    if (variantResult.rows[0].stock < quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    const result = await queryAsUser(
      userId,
      `UPDATE cart_items SET quantity = $1, updated_at = NOW()
       WHERE user_id = $2 AND variant_id = $3
       RETURNING *`,
      [quantity, userId, variant_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    res.json({ success: true, item: result.rows[0], message: 'Cart updated' });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// DELETE /api/cart/remove - Remove item from cart
router.delete('/remove', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { variant_id } = req.body;

    if (!variant_id) {
      res.status(400).json({ error: 'variant_id is required' });
      return;
    }

    const result = await queryAsUser(
      userId,
      'DELETE FROM cart_items WHERE user_id = $1 AND variant_id = $2 RETURNING *',
      [userId, variant_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// DELETE /api/cart/clear - Clear entire cart (called after order placed)
router.delete('/clear', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    await queryAsUser(userId, 'DELETE FROM cart_items WHERE user_id = $1', [userId]);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export default router;
