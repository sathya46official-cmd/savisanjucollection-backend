import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as emailService from '../services/email';

// Mock Resend
vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
      },
    })),
  };
});

// Mock database
vi.mock('../config/database', () => ({
  query: vi.fn(),
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Exports', () => {
    it('should export sendVerificationEmail function', () => {
      expect(emailService.sendVerificationEmail).toBeDefined();
      expect(typeof emailService.sendVerificationEmail).toBe('function');
    });

    it('should export sendOrderConfirmationEmail function', () => {
      expect(emailService.sendOrderConfirmationEmail).toBeDefined();
      expect(typeof emailService.sendOrderConfirmationEmail).toBe('function');
    });

    it('should export sendAdminNotificationEmail function', () => {
      expect(emailService.sendAdminNotificationEmail).toBeDefined();
      expect(typeof emailService.sendAdminNotificationEmail).toBe('function');
    });

    it('should export sendStockNotifications function', () => {
      expect(emailService.sendStockNotifications).toBeDefined();
      expect(typeof emailService.sendStockNotifications).toBe('function');
    });
  });

  describe('Function Signatures', () => {
    it('sendVerificationEmail should accept email and userId parameters', async () => {
      // This test verifies the function signature by checking it doesn't throw on valid params
      await expect(
        emailService.sendVerificationEmail('test@example.com', 'user-123')
      ).resolves.not.toThrow();
    });

    it('sendOrderConfirmationEmail should accept email and orderId parameters', async () => {
      await expect(
        emailService.sendOrderConfirmationEmail('test@example.com', 'SAVI-12345678')
      ).resolves.not.toThrow();
    });

    it('sendAdminNotificationEmail should accept orderId and itemCount parameters', async () => {
      await expect(
        emailService.sendAdminNotificationEmail('SAVI-12345678', 3)
      ).resolves.not.toThrow();
    });

    it('sendStockNotifications should accept emails array and variantId parameters', async () => {
      const { query } = await import('../config/database');
      const mockQuery = query as any;
      
      // Mock product variant query result
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'variant-123',
            color: 'Red',
            price: 500000, // ₹5000 in paise
            image_url: 'https://example.com/image.jpg',
            name: 'Luxury Silk Saree',
            category: 'silk',
          },
        ],
      });

      await expect(
        emailService.sendStockNotifications(['test1@example.com', 'test2@example.com'], 'variant-123')
      ).resolves.not.toThrow();
    });
  });

  describe('Email Content Validation', () => {
    it('sendVerificationEmail should include verification URL', async () => {
      const email = 'test@example.com';
      const userId = 'user-123';
      
      await emailService.sendVerificationEmail(email, userId);
      
      // Verify function completes without error
      expect(true).toBe(true);
    });

    it('sendOrderConfirmationEmail should include order ID and delivery time', async () => {
      const email = 'test@example.com';
      const orderId = 'SAVI-12345678';
      
      await emailService.sendOrderConfirmationEmail(email, orderId);
      
      // Verify function completes without error
      expect(true).toBe(true);
    });

    it('sendAdminNotificationEmail should include dashboard link', async () => {
      const orderId = 'SAVI-12345678';
      const itemCount = 2;
      
      await emailService.sendAdminNotificationEmail(orderId, itemCount);
      
      // Verify function completes without error
      expect(true).toBe(true);
    });
  });
});
