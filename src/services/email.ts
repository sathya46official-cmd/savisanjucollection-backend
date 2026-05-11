import { Resend } from 'resend';
import { query } from '../config/database';

// Lazy initialization of Resend client
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured in environment variables');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'orders@savisanju.com';
const ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL || 'admin@savisanju.com';
const APP_URL = process.env.API_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send email verification link to user
 * @param email - User's email address
 * @param userId - User's UUID
 */
export async function sendVerificationEmail(email: string, userId: string): Promise<void> {
  try {
    const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${userId}`;

    await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify Your Email - SaviSanju Collections',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
                font-weight: 600;
              }
              .footer {
                text-align: center;
                padding: 20px;
                color: #666;
                font-size: 14px;
                border-top: 1px solid #e0e0e0;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">SaviSanju Collections</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Luxury Sarees</p>
            </div>
            <div class="content">
              <h2>Welcome to SaviSanju Collections!</h2>
              <p>Thank you for registering with us. Please verify your email address to complete your registration.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p style="color: #666; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
              </p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you didn't create an account with SaviSanju Collections, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>SaviSanju Collections - Luxury Sarees</p>
              <p>For support, contact us at <a href="mailto:support@savisanju.com" style="color: #667eea;">support@savisanju.com</a></p>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send order confirmation email to customer
 * @param email - Customer's email address
 * @param orderId - Order ID (SAVI-XXXXXXXX format)
 */
export async function sendOrderConfirmationEmail(email: string, orderId: string): Promise<void> {
  try {
    await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Order Confirmation - ${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
              }
              .order-id {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 6px;
                text-align: center;
                font-size: 18px;
                font-weight: 600;
                color: #667eea;
                margin: 20px 0;
              }
              .info-box {
                background: #f9f9f9;
                padding: 20px;
                border-left: 4px solid #667eea;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                padding: 20px;
                color: #666;
                font-size: 14px;
                border-top: 1px solid #e0e0e0;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">Order Confirmed!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your order</p>
            </div>
            <div class="content">
              <h2>Your order has been received</h2>
              <p>Thank you for shopping with SaviSanju Collections. We've received your order and will contact you shortly to confirm the details.</p>
              
              <div class="order-id">
                Order ID: ${orderId}
              </div>

              <div class="info-box">
                <h3 style="margin-top: 0;">What happens next?</h3>
                <ol style="margin: 10px 0; padding-left: 20px;">
                  <li>Our team will review your order</li>
                  <li>We'll contact you to confirm the price and delivery details</li>
                  <li>Once confirmed, we'll process your order</li>
                  <li>Your order will be delivered within <strong>5-6 business days</strong></li>
                </ol>
              </div>

              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                <strong>Need help?</strong><br>
                If you have any questions about your order, please contact us at:<br>
                <a href="mailto:support@savisanju.com" style="color: #667eea;">support@savisanju.com</a>
              </p>
            </div>
            <div class="footer">
              <p>SaviSanju Collections - Luxury Sarees</p>
              <p>Estimated delivery: 5-6 business days</p>
              <p>Support: <a href="mailto:support@savisanju.com" style="color: #667eea;">support@savisanju.com</a></p>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`✅ Order confirmation email sent to ${email} for order ${orderId}`);
  } catch (error) {
    console.error('❌ Failed to send order confirmation email:', error);
    throw new Error('Failed to send order confirmation email');
  }
}

/**
 * Send admin notification email for new order
 * @param orderId - Order ID (SAVI-XXXXXXXX format)
 * @param itemCount - Number of items in the order
 */
export async function sendAdminNotificationEmail(orderId: string, itemCount: number): Promise<void> {
  try {
    const dashboardUrl = `${FRONTEND_URL}/admin`;

    await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🔔 New Order: ${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
              }
              .order-details {
                background: #fef3c7;
                padding: 20px;
                border-radius: 6px;
                margin: 20px 0;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
                color: white;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
                font-weight: 600;
              }
              .footer {
                text-align: center;
                padding: 20px;
                color: #666;
                font-size: 14px;
                border-top: 1px solid #e0e0e0;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">🔔 New Order Received!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Action Required</p>
            </div>
            <div class="content">
              <h2>New order needs your attention</h2>
              <p>A new order has been placed and is waiting for your review.</p>
              
              <div class="order-details">
                <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
                <p style="margin: 5px 0;"><strong>Items:</strong> ${itemCount} item${itemCount > 1 ? 's' : ''}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Pending</p>
              </div>

              <p><strong>Next Steps:</strong></p>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Review the order details in the admin dashboard</li>
                <li>Contact the customer to confirm the order</li>
                <li>Update the order status once confirmed</li>
              </ol>

              <p style="text-align: center;">
                <a href="${dashboardUrl}" class="button">View in Dashboard</a>
              </p>
            </div>
            <div class="footer">
              <p>SaviSanju Collections - Admin Notifications</p>
              <p>Dashboard: <a href="${dashboardUrl}" style="color: #f59e0b;">${dashboardUrl}</a></p>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`✅ Admin notification email sent for order ${orderId}`);
  } catch (error) {
    console.error('❌ Failed to send admin notification email:', error);
    throw new Error('Failed to send admin notification email');
  }
}

/**
 * Send "Back in Stock" notifications to all requesters
 * @param emails - Array of email addresses to notify
 * @param variantId - Product variant UUID
 */
export async function sendStockNotifications(emails: string[], variantId: string): Promise<void> {
  try {
    // Fetch product details
    const result = await query(
      `SELECT 
        pv.id,
        pv.color,
        pv.price,
        pv.image_url,
        p.name,
        p.category
      FROM product_variants pv
      INNER JOIN products p ON pv.product_id = p.id
      WHERE pv.id = $1`,
      [variantId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Product variant ${variantId} not found`);
    }

    const variant = result.rows[0];
    const productName = variant.name;
    const color = variant.color || 'Default';
    const price = (variant.price / 100).toFixed(2); // Convert paise to rupees
    const shopUrl = `${FRONTEND_URL}/shop/${variant.category}/${variantId}`;

    // Send email to each requester
    const emailPromises = emails.map((email) =>
      getResendClient().emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `🎉 Back in Stock: ${productName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 8px 8px 0 0;
                }
                .content {
                  background: #ffffff;
                  padding: 30px;
                  border: 1px solid #e0e0e0;
                  border-top: none;
                }
                .product-card {
                  background: #f9f9f9;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 20px 0;
                  text-align: center;
                }
                .product-image {
                  max-width: 100%;
                  height: auto;
                  border-radius: 6px;
                  margin-bottom: 15px;
                }
                .button {
                  display: inline-block;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 6px;
                  margin: 20px 0;
                  font-weight: 600;
                }
                .footer {
                  text-align: center;
                  padding: 20px;
                  color: #666;
                  font-size: 14px;
                  border-top: 1px solid #e0e0e0;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1 style="margin: 0;">🎉 Great News!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your requested item is back in stock</p>
              </div>
              <div class="content">
                <h2>The item you wanted is available again!</h2>
                <p>Good news! The product you requested a notification for is now back in stock.</p>
                
                <div class="product-card">
                  ${variant.image_url ? `<img src="${variant.image_url}" alt="${productName}" class="product-image">` : ''}
                  <h3 style="margin: 10px 0;">${productName}</h3>
                  <p style="color: #666; margin: 5px 0;">Color: ${color}</p>
                  <p style="font-size: 20px; font-weight: 600; color: #10b981; margin: 10px 0;">₹${price}</p>
                </div>

                <p style="text-align: center; color: #ef4444; font-weight: 600;">
                  ⚡ Limited stock available - Order now before it's gone!
                </p>

                <p style="text-align: center;">
                  <a href="${shopUrl}" class="button">Shop Now</a>
                </p>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  This notification was sent because you requested to be notified when this product becomes available.
                </p>
              </div>
              <div class="footer">
                <p>SaviSanju Collections - Luxury Sarees</p>
                <p>Shop: <a href="${FRONTEND_URL}/shop" style="color: #10b981;">${FRONTEND_URL}/shop</a></p>
              </div>
            </body>
          </html>
        `,
      })
    );

    await Promise.all(emailPromises);

    console.log(`✅ Stock notification emails sent to ${emails.length} recipient(s) for variant ${variantId}`);
  } catch (error) {
    console.error('❌ Failed to send stock notification emails:', error);
    throw new Error('Failed to send stock notification emails');
  }
}
