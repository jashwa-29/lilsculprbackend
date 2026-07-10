const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Guard: if credentials are missing, use a mock transporter that logs instead of sending
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set — email service running in MOCK mode. Emails will be logged, not sent.');
      this.isMock = true;
      this.transporter = {
        sendMail: (options) => {
          console.log('[MOCK EMAIL] Would have sent:', {
            to: options.to,
            subject: options.subject,
            preview: typeof options.html === 'string' ? options.html.substring(0, 100) + '...' : '(no html)'
          });
          return Promise.resolve({ messageId: `mock-${Date.now()}` });
        },
        verify: () => Promise.resolve(true)
      };
    } else {
      this.isMock = false;
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }

    this.from = `"Lil Sculpr Academy" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@lilsculpr.com'}>`;
    this.adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    
    // Verify connection (non-blocking)
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.verify();
        console.log('✅ Email service connected successfully');
      } else {
        console.log('⚠️ Email service running in dev/mock mode (no credentials)');
      }
    } catch (error) {
      console.error('❌ Email connection error:', error.message);
    }
  }

  /**
   * Send waitlist notification to parent
   */
  async sendWaitlistNotification(toEmail, data) {
    if (!process.env.EMAIL_USER) {
      console.log(`[MOCK EMAIL] Waitlist notification to ${toEmail}`);
      return { success: true, messageId: 'mock-id' };
    }
    
    try {
      const { parentName, childName, batch, message } = data;
      
      const batchLabel = batch.type === 'offline' ? 'Offline (Chennai)' : 'Online (Live)';
      const dayLabel = batch.dayId === 'monfri' ? 'Monday & Friday' :
                      batch.dayId === 'tuethu' ? 'Tuesday & Thursday' :
                      'Saturday & Sunday';

      const mailOptions = {
        from: this.from,
        to: toEmail,
        subject: '🎨 A Seat Has Opened Up! - Lil Sculpr Academy',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #9C29B2; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .highlight { background: #FFD700; padding: 2px 6px; border-radius: 4px; }
              .button { display: inline-block; background: #9C29B2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
              .info-box { background: #fff; border-left: 4px solid #9C29B2; padding: 15px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🎨 A Seat Has Opened Up!</h2>
              </div>
              <div class="content">
                <p>Dear <strong>${parentName}</strong>,</p>
                
                <p>Good news! A seat has become available in the <strong>${batchLabel}</strong> batch for <strong>${childName}</strong>!</p>
                
                <div class="info-box">
                  <p><strong>📅 Batch Details:</strong></p>
                  <p>• Type: ${batchLabel}</p>
                  <p>• Schedule: ${dayLabel}</p>
                  <p>• Time: ${batch.time}</p>
                </div>
                
                <p>${message || 'Please confirm your enrollment within 24 hours to secure this spot. After 24 hours, the seat will be offered to the next student on the waitlist.'}</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.WEBSITE_URL || 'https://www.lilsculpr.com'}/admin/waitlist" class="button">📋 Confirm Enrollment</a>
                </div>
                
                <p>If you have any questions, feel free to reply to this email or contact us at <strong>${process.env.EMAIL_USER || 'lilsculpr@gmail.com'}</strong>.</p>
                
                <p>Best regards,<br><strong>The Lil Sculpr Team</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Lil Sculpr Academy. All rights reserved.</p>
                <p>This is an automated notification. Please do not reply directly to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Waitlist notification sent to ${toEmail}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Waitlist notification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send birthday notification to parent
   */
  async sendBirthdayNotification(toEmail, data) {
    if (!process.env.EMAIL_USER) {
      console.log(`[MOCK EMAIL] Birthday notification to ${toEmail}`);
      return { success: true, messageId: 'mock-id' };
    }
    try {
      const { parentName, childName, age } = data;

      const mailOptions = {
        from: this.from,
        to: toEmail,
        subject: `🎂 Happy Birthday ${childName}! - Lil Sculpr Academy`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #FF6B6B, #FFB84D); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .button { display: inline-block; background: #FF6B6B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🎂 Happy Birthday ${childName}! 🎂</h2>
              </div>
              <div class="content">
                <p>Dear <strong>${parentName}</strong>,</p>
                
                <p>🎉 We're so excited to celebrate <strong>${childName}'s</strong> ${age}th birthday with you!</p>
                
                <p>At Lil Sculpr, we've had the privilege of watching ${childName} grow and create amazing clay artworks. Every sculpture tells a story, and we're honored to be part of ${childName}'s creative journey.</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.WEBSITE_URL || 'https://www.lilsculpr.com'}/gallery" class="button">🖼️ See Student Gallery</a>
                </div>
                
                <p>Wishing ${childName} a day filled with joy, laughter, and creativity! 🎨✨</p>
                
                <p>Warm regards,<br><strong>The Lil Sculpr Team</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Lil Sculpr Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Birthday notification sent to ${toEmail}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Birthday notification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send gallery submission notification
   */
  async sendGalleryNotification(toEmail, data) {
    if (!process.env.EMAIL_USER) {
      console.log(`[MOCK EMAIL] Gallery notification to ${toEmail}`);
      return { success: true, messageId: 'mock-id' };
    }
    try {
      const { parentName, childName, title, status, reason } = data;

      const statusMessages = {
        approved: `We're happy to inform you that "${title}" has been approved and will be featured in our gallery! 🎉`,
        rejected: `Thank you for submitting "${title}". Unfortunately, it doesn't meet our current guidelines. ` + (reason ? `Reason: ${reason}` : ''),
        featured: `Congratulations! "${title}" has been selected as a featured artwork! ⭐`
      };

      const mailOptions = {
        from: this.from,
        to: toEmail,
        subject: `🖼️ Gallery Submission ${status} - Lil Sculpr Academy`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${status === 'approved' ? '#4CAF50' : status === 'rejected' ? '#f44336' : '#9C29B2'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .button { display: inline-block; background: #9C29B2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🖼️ Gallery Submission ${status}</h2>
              </div>
              <div class="content">
                <p>Dear <strong>${parentName}</strong>,</p>
                
                <p>${statusMessages[status]}</p>
                
                <p><strong>Child:</strong> ${childName}</p>
                <p><strong>Artwork:</strong> ${title}</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.WEBSITE_URL || 'https://www.lilsculpr.com'}/gallery" class="button">🖼️ View Gallery</a>
                </div>
                
                <p>Keep creating amazing art! 🎨</p>
                
                <p>Best regards,<br><strong>The Lil Sculpr Team</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Lil Sculpr Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Gallery notification sent to ${toEmail}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Gallery notification error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();