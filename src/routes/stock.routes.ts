import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

// POST /api/stock/notify - Register email for back-in-stock notification
router.post('/notify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, variant_id } = req.body;

    if (!email || !variant_id) {
      res.status(400).json({ error: 'email and variant_id are required' });
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    // Check variant exists
    const variantResult = await pool.query(
      'SELECT id, quantity FROM product_variants WHERE id = $1',
      [variant_id]
    );

    if (variantResult.rows.length === 0) {
      res.status(404).json({ error: 'Product variant not found' });
      return;
    }

    // If already in stock, no need to register
    if (variantResult.rows[0].quantity > 0) {
      res.status(200).json({ 
        success: true, 
        message: 'This item is already in stock! You can add it to your cart now.' 
      });
      return;
    }

    // Upsert notification request (avoid duplicate emails per variant)
    await pool.query(
      `INSERT INTO stock_notifications (email, variant_id)
       VALUES ($1, $2)
       ON CONFLICT (email, variant_id) DO NOTHING`,
      [email, variant_id]
    );

    res.status(201).json({
      success: true,
      message: "We'll notify you at " + email + " when this item is back in stock."
    });
  } catch (error) {
    console.error('Error registering stock notification:', error);
    res.status(500).json({ error: 'Failed to register notification' });
  }
});

export default router;
