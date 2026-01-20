// services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Email Service - Loading configuration...');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'Not set');

// Create transporter with proper Gmail configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // For local development
  }
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Transporter verification failed:', error);
  } else {
    console.log('✅ Transporter is ready to send emails');
  }
});

const sendRegistrationConfirmationEmail = async (registrationData, paymentDetails) => {
  try {
    console.log('📧 Preparing to send registration confirmation email...');
    console.log('From:', process.env.EMAIL_USER);
    console.log('To:', registrationData.guardian.email);
    
    const { child, guardian, courseDetails, registrationNo } = registrationData;
    const { paymentId, paymentDate, amount } = paymentDetails;

    // Email content
    const mailOptions = {
      from: `"Lil Sculpr Admissions" <${process.env.EMAIL_USER}>`,
      to: guardian.email,
      subject: `Enrollment Confirmation - Lil Sculpr Academy | ${registrationNo}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    line-height: 1.5;
                    color: #1f2937;
                    background: #f9fafb;
                    -webkit-font-smoothing: antialiased;
                }
                
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #ffffff;
                }
                
                /* Header */
                .header {
                    background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
                    color: white;
                    padding: 48px 40px 40px;
                    text-align: center;
                }
                
                .logo {
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: -0.025em;
                    margin-bottom: 16px;
                }
                
                .header h1 {
                    font-size: 32px;
                    font-weight: 700;
                    margin-bottom: 12px;
                    letter-spacing: -0.025em;
                }
                
                .header p {
                    font-size: 16px;
                    opacity: 0.9;
                    font-weight: 400;
                }
                
                .confirmation-badge {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.15);
                    padding: 12px 24px;
                    border-radius: 50px;
                    margin-top: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                /* Content */
                .content {
                    padding: 0;
                }
                
                /* Section */
                .section {
                    padding: 40px;
                    border-bottom: 1px solid #f3f4f6;
                }
                
                .section:last-child {
                    border-bottom: none;
                }
                
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .section-title::before {
                    content: '';
                    width: 4px;
                    height: 20px;
                    background: #1e40af;
                    border-radius: 2px;
                }
                
                /* Grid Layout */
                .grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }
                
                /* Info Items */
                .info-item {
                    margin-bottom: 20px;
                }
                
                .info-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 6px;
                }
                
                .info-value {
                    font-size: 16px;
                    font-weight: 500;
                    color: #111827;
                    line-height: 1.4;
                }
                
                /* Payment Section */
                .payment-section {
                    background: #f0f9ff;
                    border: 1px solid #e0f2fe;
                    border-radius: 12px;
                    padding: 32px;
                    margin: 24px 0;
                }
                
                .payment-amount {
                    font-size: 36px;
                    font-weight: 700;
                    color: #0369a1;
                    margin: 8px 0 16px;
                }
                
                .status {
                    display: inline-flex;
                    align-items: center;
                    background: #dcfce7;
                    color: #166534;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .status::before {
                    content: '✓';
                    margin-right: 6px;
                    font-weight: bold;
                }
                
                /* Combined Section */
                .combined-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }
                
                .combined-section {
                    background: #f8fafc;
                    padding: 24px;
                    border-radius: 8px;
                    border-left: 4px solid #1e40af;
                }
                
                .combined-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .combined-title::before {
                    content: '';
                    width: 3px;
                    height: 16px;
                    background: #1e40af;
                    border-radius: 2px;
                }
                
                /* Footer */
                .footer {
                    background: #111827;
                    color: #9ca3af;
                    padding: 40px;
                    text-align: center;
                }
                
                .footer-logo {
                    font-size: 18px;
                    font-weight: 700;
                    color: white;
                    margin-bottom: 16px;
                }
                
                .footer-links {
                    display: flex;
                    justify-content: center;
                    gap: 24px;
                    margin: 20px 0;
                    flex-wrap: wrap;
                }
                
                .footer-link {
                    color: #d1d5db;
                    text-decoration: none;
                    font-size: 14px;
                }
                
                .copyright {
                    margin-top: 24px;
                    padding-top: 24px;
                    border-top: 1px solid #374151;
                    font-size: 12px;
                    color: #6b7280;
                }
                
                /* Welcome Section */
                .welcome-section {
                    text-align: center;
                    margin-bottom: 32px;
                }
                
                .welcome-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 12px;
                }
                
                .welcome-text {
                    color: #6b7280;
                    font-size: 16px;
                    line-height: 1.6;
                    max-width: 500px;
                    margin: 0 auto;
                }
                
                /* Academy Info */
                .academy-info {
                    background: #f8fafc;
                    padding: 24px;
                    border-radius: 8px;
                    margin-top: 24px;
                    text-align: center;
                }
                
                .academy-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 16px;
                }
                
                .academy-details {
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.6;
                }
                
                .academy-details div {
                    margin-bottom: 8px;
                }
                
                /* Responsive */
                @media (max-width: 640px) {
                    .header, .section {
                        padding: 32px 24px;
                    }
                    
                    .grid-2,
                    .combined-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    
                    .footer-links {
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .payment-amount {
                        font-size: 28px;
                    }
                    
                    .confirmation-badge {
                        font-size: 12px;
                        padding: 10px 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Header -->
                <div class="header">
                    <div class="logo">Lil Sculpr</div>
                    <h1>Enrollment Confirmed</h1>
                    <p>Welcome to our premium clay modeling program</p>
                    <div class="confirmation-badge">
                        Register Number: ${registrationNo}
                    </div>
                </div>
                
                <!-- Content -->
                <div class="content">
                    <!-- Welcome -->
                    <div class="section">
                        <div class="welcome-section">
                            <h2 class="welcome-title">Thank You for Choosing Lil Sculpr</h2>
                            <p class="welcome-text">
                                We're delighted to confirm your child's enrollment in our specialized clay modeling program. 
                                The creative journey begins now.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Combined Enrollment & Program Details -->
                    <div class="section">
                        <div class="section-title">Enrollment & Program Details</div>
                        <div class="combined-grid">
                            <!-- Student Information -->
                            <div class="combined-section">
                                <div class="combined-title">Student Information</div>
                                <div class="info-item">
                                    <div class="info-label">Full Name</div>
                                    <div class="info-value">${child.fullName}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Age</div>
                                    <div class="info-value">${child.age} years</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Grade</div>
                                    <div class="info-value">${child.grade}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">School</div>
                                    <div class="info-value">${child.schoolName}</div>
                                </div>
                            </div><br>
                            
                            <!-- Program Details -->
                            <div class="combined-section">
                                <div class="combined-title">Program Details</div>
                                <div class="info-item">
                                    <div class="info-label">Course Program</div>
                                    <div class="info-value">${courseDetails.courseName}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Skill Level</div>
                                    <div class="info-value">${courseDetails.levelEnrolled}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Class Schedule</div>
                                    <div class="info-value">${courseDetails.weekdays.concat(courseDetails.weekend).join(', ')}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Session Timing</div>
                                    <div class="info-value">${courseDetails.timings}</div>
                                </div>
                            </div> <br>
                            
                            <!-- Contact & Registration -->
                            <div class="combined-section">
                                <div class="combined-title">Contact & Registration</div>
                                <div class="info-item">
                                    <div class="info-label">Parent Email</div>
                                    <div class="info-value">${guardian.email}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Parent Phone</div>
                                    <div class="info-value">${guardian.phone}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Registration Number</div>
                                    <div class="info-value">${registrationNo}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Enrollment Date</div>
                                    <div class="info-value">${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Payment Confirmation -->
                    <div class="section">
                        <div class="section-title">Payment Confirmation</div>
                        <div class="payment-section">
                            <div class="info-label">Amount Paid</div>
                            <div class="payment-amount">₹${parseFloat(amount).toLocaleString('en-IN')}</div>
                            <div class="grid-2">
                                <div class="info-item">
                                    <div class="info-label">Payment ID</div>
                                    <div class="info-value">${paymentId}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Payment Date</div>
                                    <div class="info-value">${new Date(paymentDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                </div>
                            </div>
                            <div style="margin-top: 16px;">
                                <span class="status">Payment Successfully Processed</span>
                            </div>
                        </div>

                        <!-- Academy Information -->
                        <div class="academy-info">
                            <div class="academy-title">Lil Sculpr Clay Modeling Academy</div>
                            <div class="academy-details">
                                <div>📍 468 A, C sector, 2nd Street, AE Block</div>
                                <div>Anna Nagar West Extension, Chennai - 600101</div>
                                <div>📞 +91 96 00 44 31 85</div>
                                <div>🌐 www.lilsculpr.com</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    <div class="footer-logo">Lil Sculpr Clay Modeling Academy</div>
                    <p style="color: #d1d5db; max-width: 400px; margin: 0 auto;">Premium clay modeling education for young creative minds</p>
                    
                    
                    <div class="copyright">
                        &copy; ${new Date().getFullYear()} Lil Sculpr Clay Modeling Academy. All rights reserved.<br>
                        This email was sent to ${guardian.email} as confirmation of enrollment.
                    </div>
                </div>
            </div>
        </body>
        </html>
      `
    };

    // Send email
    console.log('Sending email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully to:', guardian.email);
    console.log('Message ID:', result.messageId);
    
    return { 
      success: true, 
      emailSent: true, 
      recipient: guardian.email,
      messageId: result.messageId 
    };
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { 
      success: false, 
      error: error.message,
      emailSent: false 
    };
  }
};

module.exports = {
  sendRegistrationConfirmationEmail
};