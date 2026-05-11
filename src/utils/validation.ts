import { z } from 'zod';

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// Cart schemas
export const addToCartSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z.number().int().min(1).max(10, 'Maximum 10 items per variant')
});

export const updateCartItemSchema = z.object({
  cartItemId: z.string().uuid('Invalid cart item ID'),
  quantity: z.number().int().min(1).max(10)
});

// Order schemas
export const createOrderSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'Cart cannot be empty'),
  address: z.object({
    line1: z.string().min(5, 'Address line 1 is required'),
    line2: z.string().optional(),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    postalCode: z.string().regex(/^[0-9]{6}$/, 'PIN code must be 6 digits'),
    country: z.string().default('India')
  }),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits')
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  adminNotes: z.string().optional(),
  confirmedPrice: z.number().int().positive().optional()
});

// Stock notification schema
export const stockNotificationSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  email: z.string().email('Invalid email address')
});

// Admin schemas
export const updateStockSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative')
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required')
});
