import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Apply authentication and admin middleware to all routes
router.use(authenticate);
router.use(requireAdmin);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), '..', 'public', 'uploads', 'products');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// File filter for image uploads
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST /api/admin/upload - Upload images
router.post('/upload', upload.array('images', 4), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    // Generate URLs for uploaded files
    const urls = files.map(file => {
      return `/uploads/products/${file.filename}`;
    });

    res.json({ urls });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// PUT /api/admin/stock/:variantId - Update stock quantity
router.put('/stock/:variantId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { variantId } = req.params;
    const { stock_quantity } = req.body;

    // Validate stock_quantity
    if (stock_quantity === undefined || stock_quantity === null) {
      res.status(400).json({ error: 'stock_quantity is required' });
    }

    // Validate stock_quantity is non-negative integer
    if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
      res.status(400).json({ error: 'stock_quantity must be a non-negative integer' });
    }

    const result = await pool.query(
      'UPDATE product_variants SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [stock_quantity, variantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Variant not found' });
    }

    res.json({ success: true, variant: result.rows[0] });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// GET /api/admin/orders - Get all orders with optional status filter
router.get('/orders', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        o.id,
        o.order_id,
        o.user_id,
        o.variant_id,
        o.quantity,
        o.price,
        o.confirmed_price,
        o.status,
        o.admin_notes,
        o.contacted_at,
        o.address_line1,
        o.address_line2,
        o.city,
        o.state,
        o.postal_code,
        o.country,
        o.phone,
        o.created_at,
        o.updated_at,
        up.name as customer_name,
        up.email as customer_email,
        p.name as product_name,
        pv.color as variant_color,
        pv.image_url as variant_image_url
      FROM orders o
      JOIN user_profiles up ON o.user_id = up.id
      JOIN product_variants pv ON o.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
    `;

    const values: any[] = [];

    if (status && status !== 'all') {
      query += ' WHERE o.status = $1';
      values.push(status);
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/:orderId - Get single order with full details
router.get('/orders/:orderId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(`
      SELECT 
        o.id,
        o.order_id,
        o.user_id,
        o.variant_id,
        o.quantity,
        o.price,
        o.confirmed_price,
        o.status,
        o.admin_notes,
        o.contacted_at,
        o.address_line1,
        o.address_line2,
        o.city,
        o.state,
        o.postal_code,
        o.country,
        o.phone,
        o.created_at,
        o.updated_at,
        up.name as customer_name,
        up.email as customer_email,
        p.id as product_id,
        p.name as product_name,
        p.category as product_category,
        pv.id as variant_id,
        pv.color as variant_color,
        pv.size as variant_size,
        pv.image_url as variant_image_url,
        pv.hex_code as variant_hex_code
      FROM orders o
      JOIN user_profiles up ON o.user_id = up.id
      JOIN product_variants pv ON o.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE o.order_id = $1
    `, [orderId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PUT /api/admin/orders/:orderId/status - Update order status and notes
router.put('/orders/:orderId/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    // Validate admin_notes length if provided
    if (notes !== undefined && notes !== null && notes.length > 1000) {
      res.status(400).json({ error: 'Admin notes must not exceed 1000 characters' });
    }

    // Validate status transitions
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid order status' });
    }

    // Get current order status
    const currentOrder = await pool.query('SELECT status FROM orders WHERE order_id = $1', [orderId]);
    
    if (currentOrder.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = currentOrder.rows[0].status;

    // Validate status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered'],
        'delivered': [],
        'cancelled': []
      };

      if (!validTransitions[currentStatus].includes(status)) {
        res.status(400).json({ 
          error: `Invalid status transition from ${currentStatus} to ${status}` 
        });
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`admin_notes = $${paramCount++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(orderId);

    const query = `UPDATE orders SET ${updates.join(', ')} WHERE order_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
