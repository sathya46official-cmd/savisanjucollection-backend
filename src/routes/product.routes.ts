import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { logAdminAction } from '../utils/audit';
import { resolveVariantUrls } from '../utils/imageUrl';

const router = Router();

// Get all products with their variants
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check if only featured products are requested
    const featuredOnly = req.query.featured === 'true';
    
    const query = featuredOnly
      ? `SELECT 
          p.id, p.name, p.description, p.category, p.created_at, p.featured, p.display_order,
          json_agg(
            json_build_object(
              'id', pv.id,
              'color', pv.color,
              'size', pv.size,
              'price', pv.price,
              'quantity', pv.quantity,
              'image_url', pv.image_url,
              'is_negotiable', pv.is_negotiable,
              'hex_code', pv.hex_code
            )
          ) FILTER (WHERE pv.id IS NOT NULL) as variants
        FROM products p
        LEFT JOIN product_variants pv ON p.id = pv.product_id
        WHERE p.featured = TRUE
        GROUP BY p.id
        ORDER BY p.display_order, p.name`
      : `SELECT 
          p.id, p.name, p.description, p.category, p.created_at, p.featured, p.display_order,
          json_agg(
            json_build_object(
              'id', pv.id,
              'color', pv.color,
              'size', pv.size,
              'price', pv.price,
              'quantity', pv.quantity,
              'image_url', pv.image_url,
              'is_negotiable', pv.is_negotiable,
              'hex_code', pv.hex_code
            )
          ) FILTER (WHERE pv.id IS NOT NULL) as variants
        FROM products p
        LEFT JOIN product_variants pv ON p.id = pv.product_id
        GROUP BY p.id
        ORDER BY p.created_at`;

    const result = await pool.query(query);
    const products = result.rows.map((p: any) => ({
      ...p,
      variants: p.variants ? p.variants.map(resolveVariantUrls) : []
    }));
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by ID with variants
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        p.id, p.name, p.description, p.category, p.created_at, p.featured, p.display_order,
        json_agg(
          json_build_object(
            'id', pv.id,
            'color', pv.color,
            'size', pv.size,
            'price', pv.price,
            'quantity', pv.quantity,
            'image_url', pv.image_url,
            'is_negotiable', pv.is_negotiable,
            'hex_code', pv.hex_code
          )
        ) FILTER (WHERE pv.id IS NOT NULL) as variants
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const product = result.rows[0];
    res.json({
      ...product,
      variants: product.variants ? product.variants.map(resolveVariantUrls) : []
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create new product (Admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, category, featured, display_order } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }

    // Validate name length
    if (name.length > 255) {
      res.status(400).json({ error: 'Product name must not exceed 255 characters' });
      return;
    }

    // Validate description length
    if (description && description.length > 2000) {
      res.status(400).json({ error: 'Description must not exceed 2000 characters' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO products (name, description, category, featured, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, category, featured || false, display_order || 0]
    );

    void logAdminAction(req.user, 'product.create', {
      targetType: 'product',
      targetId: result.rows[0]?.id ?? null,
      metadata: { name, category },
      ip: req.ip
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, category, featured, display_order } = req.body;

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        res.status(400).json({ error: 'Product name cannot be empty' });
        return;
      }
      if (name.length > 255) {
        res.status(400).json({ error: 'Product name must not exceed 255 characters' });
        return;
      }
    }

    // Validate description length if provided
    if (description !== undefined && description.length > 2000) {
      res.status(400).json({ error: 'Description must not exceed 2000 characters' });
      return;
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (featured !== undefined) {
      updates.push(`featured = $${paramCount++}`);
      values.push(featured);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (result.rows.length > 0) {
      void logAdminAction(req.user, 'product.update', {
        targetType: 'product',
        targetId: id,
        metadata: { fields: updates.filter(u => !u.startsWith('updated_at')) },
        ip: req.ip
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (cascade deletes variants) (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (result.rows.length > 0) {
      void logAdminAction(req.user, 'product.delete', {
        targetType: 'product',
        targetId: id,
        metadata: { name: result.rows[0]?.name },
        ip: req.ip
      });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Create product variant (Admin only)
router.post('/:id/variants', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { color, size, price, quantity, image_url, is_negotiable, hex_code } = req.body;

    if (price === undefined || price === null) {
      res.status(400).json({ error: 'Price is required' });
      return;
    }

    // Price is provided in RUPEES and must be a positive, finite number.
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Price must be a positive number (in rupees)' });
      return;
    }

    // Validate hex_code format if provided
    if (hex_code && !/^#[0-9A-Fa-f]{6}$/.test(hex_code)) {
      res.status(400).json({ error: 'Invalid hex code format. Must be #RRGGBB' });
      return;
    }

    // Deterministic conversion: rupees -> paise. The previous `price > 1000`
    // heuristic mis-stored expensive items at ~1/100th of their value
    // (massive-discount exploit), so it has been removed.
    const priceInPaise = Math.round(price * 100);

    const result = await pool.query(
      `INSERT INTO product_variants (product_id, color, size, price, quantity, image_url, is_negotiable, hex_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, color, size, priceInPaise, quantity || 0, image_url, is_negotiable || false, hex_code]
    );

    void logAdminAction(req.user, 'variant.create', {
      targetType: 'product_variant',
      targetId: result.rows[0]?.id ?? null,
      metadata: { product_id: id, color, size, price_paise: priceInPaise },
      ip: req.ip
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
});

// Update product variant (Admin only)
router.put('/variants/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { color, size, price, quantity, image_url, is_negotiable, hex_code } = req.body;

    // Validate price if provided
    if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price <= 0)) {
      res.status(400).json({ error: 'Price must be a positive number (in rupees)' });
      return;
    }

    // Validate hex_code format if provided
    if (hex_code !== undefined && hex_code && !/^#[0-9A-Fa-f]{6}$/.test(hex_code)) {
      res.status(400).json({ error: 'Invalid hex code format. Must be #RRGGBB' });
      return;
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (size !== undefined) {
      updates.push(`size = $${paramCount++}`);
      values.push(size);
    }
    if (price !== undefined) {
      // Deterministic rupees -> paise conversion (no ambiguous > 1000 heuristic).
      const priceInPaise = Math.round(price * 100);
      updates.push(`price = $${paramCount++}`);
      values.push(priceInPaise);
    }
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(quantity);
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(image_url);
    }
    if (is_negotiable !== undefined) {
      updates.push(`is_negotiable = $${paramCount++}`);
      values.push(is_negotiable);
    }
    if (hex_code !== undefined) {
      updates.push(`hex_code = $${paramCount++}`);
      values.push(hex_code);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE product_variants SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

    if (result.rows.length > 0) {
      void logAdminAction(req.user, 'variant.update', {
        targetType: 'product_variant',
        targetId: id,
        metadata: { fields: updates.filter(u => !u.startsWith('updated_at')) },
        ip: req.ip
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
});

// Delete product variant (Admin only)
router.delete('/variants/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM product_variants WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

    if (result.rows.length > 0) {
      void logAdminAction(req.user, 'variant.delete', {
        targetType: 'product_variant',
        targetId: id,
        metadata: { product_id: result.rows[0]?.product_id },
        ip: req.ip
      });
    }

    res.json({ success: true, message: 'Variant deleted successfully' });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
});

// Get all variants
router.get('/variants/all', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        pv.*,
        p.name as product_name,
        p.description as product_description
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      ORDER BY p.name, pv.color
    `);

    res.json(result.rows.map(resolveVariantUrls));
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

// Get single variant by ID
router.get('/variants/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        pv.*,
        p.name as product_name,
        p.description as product_description,
        p.category
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

    res.json(resolveVariantUrls(result.rows[0]));
  } catch (error) {
    console.error('Error fetching variant:', error);
    res.status(500).json({ error: 'Failed to fetch variant' });
  }
});

export default router;
