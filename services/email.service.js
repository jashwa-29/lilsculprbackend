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

  /**
   * Send fee reminder email to parent
   */
  async sendFeeReminderEmail(student, feeMonth, feeYear, dueDate) {
    if (!student.email) {
      console.log(`[MOCK EMAIL] Fee reminder to ${student.parentName} (no email)`);
      return { success: false, error: 'No email address' };
    }

    try {
      const monthlyFee = student.classType === 'offline' ? 2500 : 2200;
      const paymentLink = `${process.env.WEBSITE_URL || 'https://www.lilsculpr.com'}/fee-payment.html`;

      const mailOptions = {
        from: this.from,
        to: student.email,
        subject: `📅 Monthly Fee Reminder - ${student.childName} | Lil Sculpr Academy`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #9C29B2, #B84DD1); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .fee-box { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .fee-amount { font-size: 28px; font-weight: bold; color: #9C29B2; }
              .button { display: inline-block; background: #9C29B2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🎨 Monthly Fee Reminder</h2>
                <p>Lil Sculpr Clay Modelling Academy</p>
              </div>
              <div class="content">
                <p>Dear <strong>${student.parentName}</strong>,</p>
                
                <p>This is a friendly reminder that the monthly fee for <strong>${student.childName}</strong> is due.</p>
                
                <div class="fee-box">
                  <h3>📋 Fee Details</h3>
                  <p><strong>Student:</strong> ${student.childName}</p>
                  <p><strong>Enrollment ID:</strong> ${student.enrollmentId}</p>
                  <p><strong>Month:</strong> ${feeMonth} ${feeYear}</p>
                  <p><strong>Amount:</strong> <span class="fee-amount">₹${monthlyFee.toLocaleString('en-IN')}</span></p>
                  <p><strong>Due Date:</strong> ${dueDate}</p>
                </div>
                
                <p>Please make the payment before the due date to ensure uninterrupted classes.</p>
                
                <div style="text-align: center;">
                  <a href="${paymentLink}" class="button">💳 Pay Now</a>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                  <strong>Note:</strong> You will need your Enrollment ID and registered phone number to make the payment.
                </p>
                
                <p>If you have already made the payment, please ignore this reminder.</p>
                
                <p>Best regards,<br><strong>The Lil Sculpr Team</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Lil Sculpr Academy. All rights reserved.</p>
                <p>468 A, C sector, 2nd Street, AE Block, Anna Nagar West Extension, Chennai - 600101</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      if (this.isMock) {
        console.log(`[MOCK EMAIL] Fee reminder to ${student.email}`);
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Fee reminder sent to ${student.email}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Fee reminder email error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send fee payment confirmation email
   */
  async sendFeePaymentConfirmation(student, feeRecord) {
    if (!student.email) {
      console.log(`[MOCK EMAIL] Fee confirmation to ${student.parentName} (no email)`);
      return { success: false, error: 'No email address' };
    }

    try {
      const mailOptions = {
        from: this.from,
        to: student.email,
        subject: `✅ Fee Payment Confirmed - ${student.childName} | Lil Sculpr Academy`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #22C55E, #16A34A); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .fee-box { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .fee-amount { font-size: 28px; font-weight: bold; color: #16A34A; }
              .status-badge { display: inline-block; background: #22C55E; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>✅ Payment Confirmed!</h2>
                <p>Lil Sculpr Clay Modelling Academy</p>
              </div>
              <div class="content">
                <p>Dear <strong>${student.parentName}</strong>,</p>
                
                <p>We are pleased to confirm that the monthly fee payment for <strong>${student.childName}</strong> has been successfully received.</p>
                
                <div class="fee-box">
                  <h3>📋 Payment Details</h3>
                  <p><strong>Student:</strong> ${student.childName}</p>
                  <p><strong>Enrollment ID:</strong> ${student.enrollmentId}</p>
                  <p><strong>Month:</strong> ${feeRecord.month} ${feeRecord.year}</p>
                  <p><strong>Amount:</strong> <span class="fee-amount">₹${feeRecord.amount.toLocaleString('en-IN')}</span></p>
                  <p><strong>Payment Method:</strong> ${feeRecord.paymentMethod}</p>
                  <p><strong>Payment Date:</strong> ${new Date(feeRecord.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><span class="status-badge">✅ PAID</span></p>
                </div>
                
                <p>Thank you for your timely payment! Your child's classes will continue without any interruption.</p>
                
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

      if (this.isMock) {
        console.log(`[MOCK EMAIL] Fee confirmation to ${student.email}`);
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Fee confirmation sent to ${student.email}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Fee confirmation email error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk fee reminders to all students with pending fees
   */
  async sendBulkFeeReminders(studentsWithPendingFees) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const student of studentsWithPendingFees) {
      const now = new Date();
      const month = now.toLocaleString('en-IN', { month: 'long' });
      const year = now.getFullYear();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), 5).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const result = await this.sendFeeReminderEmail(student, month, year, dueDate);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ studentId: student._id, error: result.error });
      }
    }

    return results;
  }

  /**
   * Send compensation request notification to admin
   */
  async sendCompensationRequestNotification(request, student) {
    if (this.isMock) {
      console.log(`[MOCK EMAIL] Compensation request notification to admin`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
      
      const mailOptions = {
        from: this.from,
        to: adminEmail,
        subject: `📋 New Compensation Request - ${student.childName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .info-box { background: white; border-left: 4px solid #6366f1; padding: 15px; margin: 15px 0; }
              .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
              .status-pending { display: inline-block; background: #fef9c3; color: #854d0e; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>📋 New Compensation Request</h2>
              </div>
              <div class="content">
                <p><strong>Student:</strong> ${student.childName} (${student.enrollmentId})</p>
                <p><strong>Parent:</strong> ${student.parentName}</p>
                <p><strong>Contact:</strong> ${student.contact1}</p>
                <p><strong>Email:</strong> ${student.email || 'Not provided'}</p>
                
                <div class="info-box">
                  <h4>📍 Requested Class Details</h4>
                  <p><strong>Date:</strong> ${new Date(request.requestedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><strong>Type:</strong> ${request.requestedBatchType === 'offline' ? '🏫 Offline' : '💻 Online'}</p>
                  <p><strong>Time:</strong> ${request.requestedTime}</p>
                  ${request.reason ? `<p><strong>Reason:</strong> ${request.reason}</p>` : ''}
                </div>
                
                <p><span class="status-pending">⏳ Pending Review</span></p>
                
                <p style="text-align: center;">
                  <a href="${process.env.WEBSITE_URL || 'https://www.lilsculpr.com'}/admin/compensations" class="button">📋 Review Request</a>
                </p>
                
                <p>This request was submitted by the parent through the Parents Portal.</p>
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
      console.log(`✅ Compensation request notification sent to admin`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Compensation request notification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send compensation request accepted email to parent
   */
  async sendCompensationRequestAccepted(request, record) {
    if (this.isMock) {
      console.log(`[MOCK EMAIL] Compensation request accepted to ${request.email}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const mailOptions = {
        from: this.from,
        to: request.email,
        subject: `✅ Compensation Request Accepted - ${request.childName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .info-box { background: white; border-left: 4px solid #22c55e; padding: 15px; margin: 15px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
              .status-accepted { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>✅ Compensation Request Accepted</h2>
              </div>
              <div class="content">
                <p>Dear <strong>${request.parentName}</strong>,</p>
                
                <p>We are pleased to inform you that the compensation (make-up) class request for <strong>${request.childName}</strong> has been <strong>ACCEPTED</strong>.</p>
                
                <div class="info-box">
                  <h4>📍 Make-up Class Details</h4>
                  <p><strong>Date:</strong> ${new Date(request.requestedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><strong>Type:</strong> ${request.requestedBatchType === 'offline' ? '🏫 Offline' : '💻 Online'}</p>
                  <p><strong>Time:</strong> ${request.requestedTime}</p>
                </div>
                
                <p><span class="status-accepted">✅ Accepted</span></p>
                
                ${request.adminNotes ? `<p><strong>Admin Notes:</strong> ${request.adminNotes}</p>` : ''}
                
                <p>Your child's make-up class has been booked. Please ensure they attend the class on the scheduled date.</p>
                
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
      console.log(`✅ Compensation request accepted email sent to ${request.email}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Compensation request accepted email error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send compensation request rejected email to parent
   */
  async sendCompensationRequestRejected(request) {
    if (this.isMock) {
      console.log(`[MOCK EMAIL] Compensation request rejected to ${request.email}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const mailOptions = {
        from: this.from,
        to: request.email,
        subject: `❌ Compensation Request Update - ${request.childName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .info-box { background: white; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
              .status-rejected { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>❌ Compensation Request Update</h2>
              </div>
              <div class="content">
                <p>Dear <strong>${request.parentName}</strong>,</p>
                
                <p>We regret to inform you that the compensation (make-up) class request for <strong>${request.childName}</strong> has been <strong>REJECTED</strong>.</p>
                
                <div class="info-box">
                  <h4>📍 Requested Details</h4>
                  <p><strong>Date:</strong> ${new Date(request.requestedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><strong>Time:</strong> ${request.requestedTime}</p>
                </div>
                
                <p><span class="status-rejected">❌ Rejected</span></p>
                
                <p><strong>Reason:</strong> ${request.rejectionReason}</p>
                
                ${request.adminNotes ? `<p><strong>Additional Notes:</strong> ${request.adminNotes}</p>` : ''}
                
                <p>If you have any questions, please contact us at <strong>${process.env.EMAIL_USER || 'lilsculpr@gmail.com'}</strong>.</p>
                
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
      console.log(`✅ Compensation request rejected email sent to ${request.email}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Compensation request rejected email error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendRegistrationConfirmation(toEmail, data) {
    try {
      console.log(`📧 Sending registration confirmation to ${toEmail}`);

      const mailOptions = {
        from: this.from,
        to: toEmail,
        subject: `✅ Registration Confirmed - ${data.carnivalName} | ${data.registrationId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1f2937; background: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #9C29B2 0%, #FF6B00 100%); color: white; padding: 40px; text-align: center; }
            .header h1 { font-size: 28px; margin-bottom: 8px; }
            .badge { display: inline-block; background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 50px; font-size: 13px; font-weight: 600; margin-top: 16px; border: 1px solid rgba(255,255,255,0.2); }
            .content { padding: 40px; }
            .section { margin-bottom: 32px; }
            .section-title { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .info-value { font-size: 15px; font-weight: 500; color: #111827; }
            .payment-box { background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 12px; padding: 24px; margin-top: 20px; }
            .payment-amount { font-size: 32px; font-weight: 700; color: #0369a1; margin: 8px 0; }
            .status-paid { display: inline-flex; align-items: center; background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
            .footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
          </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎨 Registration Confirmed!</h1>
                <p>Thank you for registering with Lil Sculpr Clay Academy</p>
                <div class="badge">${data.registrationId}</div>
              </div>
              <div class="content">
                <div class="section">
                  <div class="section-title">👤 Participant Details</div>
                  <div class="grid-2">
                    <div>
                      <div class="info-label">Parent Name</div>
                      <div class="info-value">${data.parentName}</div>
                    </div>
                    <div>
                      <div class="info-label">Child Name</div>
                      <div class="info-value">${data.childName}</div>
                    </div>
                  </div>
                </div>
                <div class="section">
                  <div class="section-title">🎪 Workshop Details</div>
                  <div class="grid-2">
                    <div>
                      <div class="info-label">Workshop</div>
                      <div class="info-value">${data.carnivalName}</div>
                    </div>
                    <div>
                      <div class="info-label">Date</div>
                      <div class="info-value">${data.date}</div>
                    </div>
                    <div>
                      <div class="info-label">Time</div>
                      <div class="info-value">${data.batchTime}</div>
                    </div>
                    <div>
                      <div class="info-label">Batch</div>
                      <div class="info-value">${data.batch}</div>
                    </div>
                  </div>
                </div>
                <div class="payment-box">
                  <div class="section-title" style="border-bottom: none; margin-bottom: 8px;">💳 Payment Details</div>
                  <div class="status-paid">✓ Payment Successful</div>
                  <div class="payment-amount">₹${data.amount}</div>
                  <div class="grid-2">
                    <div>
                      <div class="info-label">Payment ID</div>
                      <div class="info-value" style="font-family: monospace; font-size: 13px;">${data.paymentId}</div>
                    </div>
                    <div>
                      <div class="info-label">Paid On</div>
                      <div class="info-value">${data.paymentDate} at ${data.paymentTime}</div>
                    </div>
                  </div>
                </div>
                <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                  📍 <strong>Venue:</strong> 468 A, C sector, 2nd Street, AE Block, Anna Nagar West Extension, Chennai - 600101
                </p>
                <p style="color: #6b7280; font-size: 14px;">
                  For any queries, contact us at <strong>+91 96 00 44 31 85</strong> or <strong>lilsculpr@gmail.com</strong>
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Lil Sculpr Clay Academy. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Registration confirmation email sent to ${toEmail}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Registration confirmation email error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendAdminNotification(registration) {
    try {
      console.log(`📧 Sending admin notification for ${registration.registrationId}`);

      if (!this.adminEmail) {
        console.warn('⚠️ ADMIN_EMAIL not configured — skipping admin notification');
        return { success: false, error: 'ADMIN_EMAIL not configured' };
      }

      const mailOptions = {
        from: this.from,
        to: this.adminEmail,
        subject: `🆕 New Registration - ${registration.carnivalName} | ${registration.registrationId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1f2937; background: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); color: white; padding: 32px; text-align: center; }
            .header h1 { font-size: 24px; }
            .content { padding: 32px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .value { font-size: 15px; font-weight: 500; color: #111827; margin-bottom: 12px; }
            .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
          </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🆕 New Workshop Registration</h1>
                <p style="opacity: 0.9; margin-top: 8px;">${registration.registrationId}</p>
              </div>
              <div class="content">
                <div class="grid-2">
                  <div>
                    <div class="label">Parent Name</div>
                    <div class="value">${registration.parentName}</div>
                  </div>
                  <div>
                    <div class="label">Phone</div>
                    <div class="value">${registration.phone || registration.contact1}</div>
                  </div>
                  <div>
                    <div class="label">Email</div>
                    <div class="value">${registration.email}</div>
                  </div>
                  <div>
                    <div class="label">Child Name</div>
                    <div class="value">${registration.childName}</div>
                  </div>
                  <div>
                    <div class="label">Child Age</div>
                    <div class="value">${registration.childAge}</div>
                  </div>
                  <div>
                    <div class="label">Workshop</div>
                    <div class="value">${registration.carnivalName}</div>
                  </div>
                  <div>
                    <div class="label">Date</div>
                    <div class="value">${registration.selectedDate ? new Date(registration.selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
                  </div>
                  <div>
                    <div class="label">Time</div>
                    <div class="value">${registration.batchTime}</div>
                  </div>
                </div>
                <p style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
                  ⚡ This registration has been paid and confirmed. Login to admin panel for more details.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Lil Sculpr Clay Academy</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Admin notification sent for ${registration.registrationId}`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('❌ Admin notification error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();