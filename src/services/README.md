# Email Service Documentation

## Overview

The email service provides utilities for sending transactional emails using [Resend](https://resend.com) (free tier: 3,000 emails/month).

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```env
# Email Service (Resend)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=orders@savisanju.com
RESEND_ADMIN_EMAIL=admin@savisanju.com

# URLs
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

### 2. Get Resend API Key

1. Visit [https://resend.com](https://resend.com)
2. Sign up for a free account (3,000 emails/month)
3. Create an API key in the dashboard
4. Add the API key to your `.env` file

### 3. Verify Domain (Optional for Production)

For production use, verify your domain in Resend:
1. Go to Resend Dashboard → Domains
2. Add your domain (e.g., `savisanju.com`)
3. Add the DNS records provided by Resend
4. Wait for verification (usually takes a few minutes)

## Available Functions

### 1. `sendVerificationEmail(email, userId)`

Sends an email verification link to a newly registered user.

**Parameters:**
- `email` (string): User's email address
- `userId` (string): User's UUID

**Usage:**
```typescript
import { sendVerificationEmail } from '../services/email';

await sendVerificationEmail('user@example.com', 'user-uuid-123');
```

**Email Content:**
- Subject: "Verify Your Email - SaviSanju Collections"
- Contains: Verification link, branded template
- Link format: `{API_URL}/api/auth/verify-email?token={userId}`

---

### 2. `sendOrderConfirmationEmail(email, orderId)`

Sends an order confirmation email to the customer after order placement.

**Parameters:**
- `email` (string): Customer's email address
- `orderId` (string): Order ID in SAVI-XXXXXXXX format

**Usage:**
```typescript
import { sendOrderConfirmationEmail } from '../services/email';

await sendOrderConfirmationEmail('customer@example.com', 'SAVI-12345678');
```

**Email Content:**
- Subject: "Order Confirmation - {orderId}"
- Contains: Order ID, next steps, estimated delivery (5-6 business days)
- Support contact: support@savisanju.com

---

### 3. `sendAdminNotificationEmail(orderId, itemCount)`

Sends a notification to the admin when a new order is placed.

**Parameters:**
- `orderId` (string): Order ID in SAVI-XXXXXXXX format
- `itemCount` (number): Number of items in the order

**Usage:**
```typescript
import { sendAdminNotificationEmail } from '../services/email';

await sendAdminNotificationEmail('SAVI-12345678', 3);
```

**Email Content:**
- Subject: "🔔 New Order: {orderId}"
- Sent to: `RESEND_ADMIN_EMAIL`
- Contains: Order details, dashboard link, action items

---

### 4. `sendStockNotifications(emails, variantId)`

Sends "Back in Stock" notifications to all users who requested to be notified.

**Parameters:**
- `emails` (string[]): Array of email addresses to notify
- `variantId` (string): Product variant UUID

**Usage:**
```typescript
import { sendStockNotifications } from '../services/email';

const emails = ['user1@example.com', 'user2@example.com'];
await sendStockNotifications(emails, 'variant-uuid-123');
```

**Email Content:**
- Subject: "🎉 Back in Stock: {productName}"
- Contains: Product image, name, color, price, shop link
- Fetches product details from database automatically

---

## Error Handling

All functions throw errors if the email fails to send. Wrap calls in try-catch blocks:

```typescript
try {
  await sendOrderConfirmationEmail(email, orderId);
  console.log('Email sent successfully');
} catch (error) {
  console.error('Failed to send email:', error);
  // Handle error (log, retry, notify admin, etc.)
}
```

## Email Templates

All emails use branded HTML templates with:
- Responsive design (mobile-friendly)
- SaviSanju Collections branding
- Gradient headers (purple for user emails, orange for admin)
- Professional typography and spacing
- Clear call-to-action buttons

## Testing

Run the test suite:

```bash
npm test -- email.test.ts
```

The tests verify:
- All functions are exported correctly
- Function signatures accept correct parameters
- Functions complete without errors (with mocked Resend)

## Production Considerations

### Rate Limits
- Free tier: 3,000 emails/month
- If you exceed this, upgrade to a paid plan or implement email queuing

### Email Deliverability
- Verify your domain in Resend for better deliverability
- Monitor bounce rates and spam complaints
- Use a professional "from" email (e.g., orders@savisanju.com)

### Error Monitoring
- Log all email failures
- Set up alerts for critical emails (order confirmations, admin notifications)
- Consider implementing retry logic for transient failures

### Email Queue (Future Enhancement)
For high-volume scenarios, consider implementing an email queue:
- Use Redis or a message queue (RabbitMQ, AWS SQS)
- Process emails asynchronously
- Implement retry logic with exponential backoff

## Integration Examples

### User Registration Flow
```typescript
// In auth.controller.ts
import { sendVerificationEmail } from '../services/email';

export const register = async (req: Request, res: Response) => {
  // ... create user ...
  
  // Send verification email
  await sendVerificationEmail(validated.email, userId);
  
  res.status(201).json({
    message: 'Registration successful. Please check your email to verify your account.'
  });
};
```

### Order Placement Flow
```typescript
// In orders.controller.ts
import { sendOrderConfirmationEmail, sendAdminNotificationEmail } from '../services/email';

export const createOrder = async (req: Request, res: Response) => {
  // ... create order ...
  
  // Send emails in parallel
  await Promise.all([
    sendOrderConfirmationEmail(customerEmail, orderId),
    sendAdminNotificationEmail(orderId, itemCount)
  ]);
  
  res.status(201).json({ orderId });
};
```

### Stock Update Flow
```typescript
// In admin.controller.ts
import { sendStockNotifications } from '../services/email';

export const updateStock = async (req: Request, res: Response) => {
  const { variantId, quantity } = req.body;
  
  // ... update stock ...
  
  // If stock was 0 and now > 0, notify requesters
  if (previousQuantity === 0 && quantity > 0) {
    const notifications = await getStockNotificationRequests(variantId);
    const emails = notifications.map(n => n.email);
    
    await sendStockNotifications(emails, variantId);
    
    // Mark notifications as sent
    await markNotificationsAsSent(variantId);
  }
  
  res.status(200).json({ message: 'Stock updated' });
};
```

## Troubleshooting

### Email not sending
1. Check `RESEND_API_KEY` is set correctly
2. Verify API key is active in Resend dashboard
3. Check console logs for error messages
4. Verify "from" email is verified in Resend

### Email going to spam
1. Verify your domain in Resend
2. Add SPF, DKIM, and DMARC records
3. Avoid spam trigger words in subject/content
4. Use a professional "from" email address

### Rate limit exceeded
1. Check current usage in Resend dashboard
2. Upgrade to paid plan if needed
3. Implement email queuing to spread load
4. Consider batching notifications

## Support

For issues with the email service:
- Check Resend documentation: https://resend.com/docs
- Review Resend status page: https://status.resend.com
- Contact Resend support: support@resend.com
