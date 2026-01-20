const nodemailer = require('nodemailer');
const path = require('path');

class EmailService {
    constructor() {
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
        
        // Constants for consistent URLs
        this.constants = {
            WEBSITE_URL: 'https://www.lilsculpr.com',
            CONTACT_PAGE: 'https://www.lilsculpr.com/contact.html',
            WORKSHOPS_PAGE: 'https://www.lilsculpr.com/workshops.html',
            GOOGLE_MAPS: 'https://maps.app.goo.gl/SzTjsg2eUhcYztik8',
            EMAIL_SUPPORT: 'lilsculpr@gmail.com',
            PHONE_NUMBER: '+91 9600 443 185',
            SOCIAL: {
                FACEBOOK: 'https://facebook.com/lilsculpr',
                INSTAGRAM: 'https://instagram.com/lilsculpr',
                YOUTUBE: 'https://youtube.com/lilsculpr',
                WHATSAPP: 'https://wa.me/919600443185'
            }
        };
        
        // Test connection
        this.verifyConnection();
    }

    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('✅ Email service connected successfully');
        } catch (error) {
            console.error('❌ Email connection error:', error.message);
        }
    }

    // ==================== REGISTRATION EMAILS ====================

    async sendRegistrationConfirmation(toEmail, data) {
        try {
            console.log(`📧 Sending registration confirmation to: ${toEmail}`);
            
            const {
                parentName,
                childName,
                batch,
                batchTime,
                date,
                formattedDate,
                shortDate,
                registrationId,
                paymentId,
                amount,
                paymentDate,
                paymentTime
            } = data;

            const mailOptions = {
                from: `"Lil Sculpr Clay Academy" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: toEmail,
                replyTo: this.constants.EMAIL_SUPPORT,
                subject: 'Republic Day Special Workshop - Registration Confirmed!',
                html: this.generateRegistrationEmailHTML({
                    parentName,
                    childName,
                    batch,
                    batchTime: batchTime || this.extractTimeFromBatch(batch),
                    date: formattedDate || date,
                    shortDate: shortDate || this.formatShortDate(date),
                    registrationId,
                    paymentId,
                    amount,
                    paymentDate,
                    paymentTime
                }),
                attachments: this.getEmailAttachments()
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Confirmation email sent to ${toEmail}: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info)
            };
            
        } catch (error) {
            console.error('❌ Registration confirmation email error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

generateRegistrationEmailHTML(data) {
    const currentYear = new Date().getFullYear();
    const { 
        WEBSITE_URL, 
        CONTACT_PAGE, 
        GOOGLE_MAPS, 
        EMAIL_SUPPORT, 
        PHONE_NUMBER,
        SOCIAL 
    } = this.constants;
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Republic Day Special Workshop - Registration Confirmed!</title>
            <style>
                /* Reset and Base Styles */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Arial', 'Helvetica', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background-color: #f7f9fc;
                    margin: 0;
                    padding: 20px;
                }
                
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                /* Header Section */
                .header {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                    padding: 40px 20px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }
                
                .header:before {
                    content: '❄️';
                    font-size: 80px;
                    opacity: 0.1;
                    position: absolute;
                    top: 20px;
                    right: 20px;
                }
                
                .header h1 {
                    font-size: 28px;
                    margin-bottom: 10px;
                    font-weight: bold;
                }
                
                .header p {
                    font-size: 16px;
                    opacity: 0.9;
                }
                
                .logo {
                    font-size: 32px;
                    margin-bottom: 15px;
                    display: block;
                }
                
                /* Content Section */
                .content {
                    padding: 40px 30px;
                }
                
                .greeting {
                    font-size: 18px;
                    margin-bottom: 30px;
                    color: #2c3e50;
                }
                
                .greeting strong {
                    color: #e74c3c;
                }
                
                /* Confirmation Card */
                .confirmation-card {
                    background: linear-gradient(to right, #e8f4fc, #f0f8ff);
                    border-radius: 10px;
                    padding: 25px;
                    margin: 25px 0;
                    border-left: 5px solid #3498db;
                }
                
                .confirmation-title {
                    color: #2980b9;
                    font-size: 22px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .confirmation-title:before {
                    content: '✅';
                    font-size: 24px;
                }
                
                /* Details Table */
                .details-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                
                .details-table tr {
                    border-bottom: 1px solid #eee;
                }
                
                .details-table tr:last-child {
                    border-bottom: none;
                }
                
                .details-table td {
                    padding: 15px 10px;
                }
                
                .details-label {
                    font-weight: bold;
                    color: #2c3e50;
                    width: 40%;
                }
                
                .details-value {
                    color: #34495e;
                }
                
                .highlight {
                    color: #e74c3c;
                    font-weight: bold;
                    background: #ffeaa7;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                
                /* Info Boxes */
                .info-box {
                    background: #fff8e1;
                    border: 2px solid #ffd54f;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 25px 0;
                }
                
                .info-box h3 {
                    color: #f57c00;
                    margin-bottom: 15px;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .info-box h3:before {
                    content: '📌';
                }
                
                .info-box p {
                    margin-bottom: 10px;
                }
                
                /* Contact Box */
                .contact-box {
                    background: #e8f5e9;
                    border: 2px solid #4caf50;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 25px 0;
                }
                
                .contact-box h3 {
                    color: #2e7d32;
                    margin-bottom: 15px;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .contact-box h3:before {
                    content: '📞';
                }
                
                .contact-info {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                    margin-top: 15px;
                }
                
                .contact-item {
                    flex: 1 1 calc(33.333% - 20px);
                    min-width: 0;
                }
                
                .contact-item strong {
                    display: block;
                    color: #555;
                    margin-bottom: 5px;
                }
                
                .contact-item a {
                    color: #3498db;
                    text-decoration: none;
                    word-break: break-word;
                }
                
                .contact-item a:hover {
                    text-decoration: underline;
                }
                
                /* CTA Button */
                .cta-section {
                    text-align: center;
                    margin: 30px 0;
                }
                
                .cta-button {
                    display: inline-block;
                    background: linear-gradient(to right, #27ae60, #2ecc71);
                    color: white;
                    padding: 15px 35px;
                    text-decoration: none;
                    border-radius: 50px;
                    font-weight: bold;
                    font-size: 16px;
                    transition: transform 0.3s, box-shadow 0.3s;
                    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
                }
                
                .cta-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
                }
                
                /* Footer */
                .footer {
                    background: #2c3e50;
                    color: white;
                    padding: 30px;
                    text-align: center;
                    font-size: 14px;
                }
                
                .footer-links {
                    margin: 20px 0;
                }
                
                .footer-links a {
                    color: #3498db;
                    text-decoration: none;
                    margin: 0 15px;
                }
                
                .footer-links a:hover {
                    text-decoration: underline;
                }
                
                .social-icons {
                    margin: 20px 0;
                }
                
                .social-icons a {
                    color: white;
                    text-decoration: none;
                    margin: 0 10px;
                    font-size: 20px;
                    display: inline-block;
                    width: 40px;
                    height: 40px;
                    line-height: 40px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.1);
                    transition: background 0.3s;
                }
                
                .social-icons a:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateY(-2px);
                }
                
                .copyright {
                    margin-top: 20px;
                    color: #95a5a6;
                    font-size: 13px;
                }
                
                /* Responsive Styles */
                @media (max-width: 768px) {
                    .contact-item {
                        flex: 1 1 calc(50% - 20px);
                    }
                }
                
                @media (max-width: 600px) {
                    .content {
                        padding: 20px;
                    }
                    
                    .details-table td {
                        display: block;
                        width: 100%;
                        padding: 10px 0;
                    }
                    
                    .details-label {
                        width: 100%;
                        margin-bottom: 5px;
                    }
                    
                    .contact-info {
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    .contact-item {
                        flex: 1 1 100%;
                        width: 100%;
                        padding-bottom: 15px;
                        border-bottom: 1px solid rgba(85, 85, 85, 0.2);
                    }
                    
                    .contact-item:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }
                    
                    .header h1 {
                        font-size: 24px;
                    }
                    
                    .footer-links a {
                        display: block;
                        margin: 10px 0;
                    }
                    
                    .confirmation-card {
                        padding: 20px;
                    }
                    
                    .info-box, .contact-box {
                        padding: 15px;
                    }
                }
                
                @media (max-width: 480px) {
                    body {
                        padding: 10px;
                    }
                    
                    .header {
                        padding: 30px 15px;
                    }
                    
                    .header h1 {
                        font-size: 22px;
                    }
                    
                    .cta-button {
                        padding: 12px 25px;
                        font-size: 15px;
                    }
                    
                    .footer {
                        padding: 20px 15px;
                    }
                }
                
                /* Print Styles */
                @media print {
                    body {
                        background: white;
                        padding: 0;
                    }
                    
                    .email-container {
                        box-shadow: none;
                        border: 1px solid #ddd;
                    }
                    
                    .cta-button {
                        display: none;
                    }
                    
                    .footer {
                        background: #f5f5f5;
                        color: #333;
                    }
                    
                    .footer-links a {
                        color: #2c3e50;
                    }
                    
                    .social-icons {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <!-- Header -->
                <div class="header">
                    <h1>Republic Day Special Workshop</h1>
                    <p>Registration Confirmed! 🎉</p>
                </div>
                
                <!-- Content -->
                <div class="content">
                    <!-- Greeting -->
                    <div class="greeting">
                        <p>Dear <strong>${data.parentName}</strong>,</p>
                        <p>Thank you for registering <strong>${data.childName}</strong> for our Republic Day Special Workshop! We're excited to have your child join us for a creative adventure.</p>
                    </div>
                    
                    <!-- Confirmation Card -->
                    <div class="confirmation-card">
                        <h2 class="confirmation-title">Registration Details</h2>
                        
                        <table class="details-table">
                            <tr>
                                <td class="details-label">Registration ID:</td>
                                <td class="details-value"><span class="highlight">${data.registrationId}</span></td>
                            </tr>
                            <tr>
                                <td class="details-label">Payment ID:</td>
                                <td class="details-value">${data.paymentId}</td>
                            </tr>
                            <tr>
                                <td class="details-label">Amount Paid:</td>
                                <td class="details-value">₹${data.amount}</td>
                            </tr>
                            <tr>
                                <td class="details-label">Date:</td>
                                <td class="details-value"><strong>${data.date}</strong></td>
                            </tr>
                            <tr>
                                <td class="details-label">Time:</td>
                                <td class="details-value"><strong>${data.batchTime}</strong></td>
                            </tr>
                            <tr>
                                <td class="details-label">Payment Date:</td>
                                <td class="details-value">${data.paymentDate || new Date().toLocaleDateString('en-IN')} ${data.paymentTime ? 'at ' + data.paymentTime : ''}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Important Information -->
                    <div class="info-box">
                        <h3>📍 Workshop Venue & Instructions</h3>
                        <p><strong>Venue:</strong><br>
                        Lil Sculpr Clay Academy<br>
                        468 A, C Sector, 2nd Street, AE Block,<br>
                        Anna Nagar West Extension,<br>
                        Chennai - 600101</p>
                        
                        <p><strong>Important Instructions:</strong></p>
                        <ul style="padding-left: 20px; margin: 10px 0;">
                            <li>Please arrive <strong>15 minutes before</strong> the workshop start time</li>
                            <li>Carry this confirmation email (digital or print)</li>
                            <li>Wear comfortable clothing that can get a little messy</li>
                            <li>All art materials will be provided</li>
                            <li>Parents can wait in our comfortable lounge area</li>
                            <li>Bring a water bottle for your child</li>
                            <li>Free parking available at the venue</li>
                        </ul>
                    </div>
                    
                    <!-- Contact Information -->
                    <div class="contact-box">
                        <h3>📞 Contact Information</h3>
                        <div class="contact-info">
                            <div class="contact-item">
                                <strong>Phone:</strong>
                                <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a>
                            </div>
                            <div class="contact-item">
                                <strong>Email:</strong>
                                <a href="mailto:${EMAIL_SUPPORT}">${EMAIL_SUPPORT}</a>
                            </div>
                            <div class="contact-item">
                                <strong>Website:</strong>
                                <a href="${WEBSITE_URL}" target="_blank">lilsculpr.com</a>
                            </div>
                        </div>
                        <p style="margin-top: 15px; font-size: 14px; color: #555;">
                            For any queries or assistance, please contact us via email or phone during business hours (9 AM - 7 PM).
                        </p>
                    </div>
                    
                    <!-- CTA Button -->
                    <div class="cta-section">
                        <a href="${GOOGLE_MAPS}" class="cta-button" target="_blank">
                            📍 Get Directions to Venue
                        </a>
                    </div>
                    
                    <!-- Closing Message -->
                    <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                        <p style="font-size: 16px; color: #555; text-align: center;">
                            <em>"Creativity is intelligence having fun."</em><br>
                            - Albert Einstein
                        </p>
                    </div>
                    
                    <!-- Signature -->
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee;">
                        <p>Warm regards,</p>
                        <p style="font-size: 18px; color: #2c3e50; margin: 10px 0;">
                            <strong>The Lil Sculpr Team</strong><br>
                            <span style="color: #7f8c8d;">"Shaping Young Minds with Clay"</span>
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    <div class="footer-links">
                        <a href="${WEBSITE_URL}" target="_blank">Website</a>
                        <a href="${this.constants.WORKSHOPS_PAGE}" target="_blank">Workshops</a>
                        <a href="${CONTACT_PAGE}" target="_blank">Contact Us</a>
                    </div>
                    
                    <div class="copyright">
                        <p>© ${currentYear} Lil Sculpr Clay Academy. All rights reserved.</p>
                        <p>This is an automated confirmation email. Please do not reply directly to this email.</p>
                        <p>For assistance, contact us at <a href="mailto:${EMAIL_SUPPORT}" style="color: #3498db;">${EMAIL_SUPPORT}</a></p>
                        <p style="font-size: 12px; margin-top: 10px;">Registration ID: ${data.registrationId}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

    async sendAdminNotification(registration) {
        try {
            console.log(`📧 Sending admin notification for: ${registration.registrationId}`);
            
            const mailOptions = {
                from: `"Lil Sculpr Registration System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: process.env.ADMIN_EMAIL || this.constants.EMAIL_SUPPORT,
                subject: `🔔 New Registration: ${registration.registrationId}`,
                html: this.generateAdminNotificationHTML(registration)
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Admin notification sent: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId
            };
            
        } catch (error) {
            console.error('❌ Admin notification error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    generateAdminNotificationHTML(registration) {
        const formattedDate = registration.getFormattedDate ? registration.getFormattedDate() : 
                            (registration.selectedDate ? new Date(registration.selectedDate).toLocaleDateString('en-IN', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            }) : 'Not specified');
        
        const batchTime = registration.getBatchTime ? registration.getBatchTime() : 
                         (registration.selectedBatch ? this.extractTimeFromBatch(registration.selectedBatch) : 'Not specified');
        
        const currentTime = new Date().toLocaleString('en-IN');
        const { WEBSITE_URL, EMAIL_SUPPORT, PHONE_NUMBER, GOOGLE_MAPS } = this.constants;
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        line-height: 1.6; 
                        background: #f5f5f5;
                        margin: 0;
                        padding: 20px;
                    }
                    .container { 
                        max-width: 800px; 
                        margin: 0 auto; 
                        background: white;
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header { 
                        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); 
                        color: white; 
                        padding: 30px 20px; 
                        text-align: center;
                    }
                    .header h1 { 
                        margin: 0; 
                        font-size: 24px; 
                    }
                    .header p { 
                        margin: 10px 0 0; 
                        opacity: 0.9;
                    }
                    .content { 
                        padding: 30px; 
                    }
                    .details-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin: 25px 0; 
                        background: #fff;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .details-table th, .details-table td { 
                        padding: 15px; 
                        text-align: left; 
                        border-bottom: 1px solid #eee; 
                    }
                    .details-table th { 
                        background: #34495e; 
                        color: white; 
                        font-weight: 600;
                    }
                    .details-table tr:hover { 
                        background: #f9f9f9; 
                    }
                    .highlight { 
                        background: #fff3cd; 
                        padding: 5px 10px; 
                        border-radius: 4px; 
                        font-weight: bold;
                        color: #e74c3c;
                    }
                    .stat-box { 
                        background: linear-gradient(to right, #e8f4fc, #f0f8ff); 
                        border: 2px solid #3498db; 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 25px 0; 
                    }
                    .alert { 
                        background: #fff8e1; 
                        border: 2px solid #ffd54f; 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 20px 0; 
                    }
                    .cta-button { 
                        display: inline-block; 
                        background: linear-gradient(to right, #27ae60, #2ecc71); 
                        color: white; 
                        padding: 12px 25px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        margin: 10px 5px 10px 0;
                        font-weight: 600;
                        transition: transform 0.2s;
                    }
                    .cta-button:hover { 
                        transform: translateY(-2px); 
                        box-shadow: 0 4px 8px rgba(39, 174, 96, 0.3);
                    }
                    .venue-box {
                        background: #e8f5e9;
                        border: 2px solid #4caf50;
                        border-radius: 8px;
                        padding: 15px;
                        margin: 15px 0;
                    }
                    .footer {
                        background: #2c3e50;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        font-size: 14px;
                        margin-top: 30px;
                    }
                    .quick-info {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 15px;
                        margin: 20px 0;
                    }
                    .info-item {
                        flex: 1;
                        min-width: 200px;
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 6px;
                        border-left: 4px solid #3498db;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 New Workshop Registration Received</h1>
                        <p>Registration Time: ${currentTime}</p>
                    </div>
                    
                    <div class="content">
                        <div class="alert">
                            <strong>🎉 NEW REGISTRATION COMPLETED SUCCESSFULLY!</strong>
                            <p style="margin-top: 10px;">A new participant has registered for the Republic Day Special Workshop.</p>
                        </div>
                        
                        <div class="quick-info">
                            <div class="info-item">
                                <strong>Registration ID:</strong><br>
                                <span class="highlight">${registration.registrationId}</span>
                            </div>
                            <div class="info-item">
                                <strong>Child Details:</strong><br>
                                ${registration.childName} (${registration.childAge} years)
                            </div>
                            <div class="info-item">
                                <strong>Workshop Date:</strong><br>
                                ${formattedDate}
                            </div>
                            <div class="info-item">
                                <strong>Batch Time:</strong><br>
                                ${batchTime}
                            </div>
                        </div>
                        
                        <h2>Complete Registration Details:</h2>
                        <table class="details-table">
                            <tr>
                                <th>Field</th>
                                <th>Details</th>
                            </tr>
                            <tr>
                                <td><strong>Registration ID</strong></td>
                                <td><span class="highlight">${registration.registrationId}</span></td>
                            </tr>
                            <tr>
                                <td><strong>Child's Name</strong></td>
                                <td>${registration.childName}</td>
                            </tr>
                            <tr>
                                <td><strong>Child's Age</strong></td>
                                <td>${registration.childAge} years</td>
                            </tr>
                            <tr>
                                <td><strong>Parent's Name</strong></td>
                                <td>${registration.parentName}</td>
                            </tr>
                            <tr>
                                <td><strong>Email</strong></td>
                                <td><a href="mailto:${registration.email}">${registration.email}</a></td>
                            </tr>
                            <tr>
                                <td><strong>Phone</strong></td>
                                <td><a href="tel:${registration.phone}">${registration.phone}</a></td>
                            </tr>
                            <tr>
                                <td><strong>Workshop Date</strong></td>
                                <td>${formattedDate}</td>
                            </tr>
                            <tr>
                                <td><strong>Batch Time</strong></td>
                                <td>${batchTime}</td>
                            </tr>
                            <tr>
                                <td><strong>Payment ID</strong></td>
                                <td>${registration.payment?.razorpay_payment_id || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td><strong>Amount</strong></td>
                                <td>₹${registration.payment?.amount || 199}</td>
                            </tr>
                            <tr>
                                <td><strong>Payment Status</strong></td>
                                <td><span style="color: #27ae60; font-weight: bold;">✅ PAID</span></td>
                            </tr>
                            <tr>
                                <td><strong>Registration Time</strong></td>
                                <td>${registration.createdAt ? new Date(registration.createdAt).toLocaleString('en-IN') : currentTime}</td>
                            </tr>
                            ${registration.message ? `
                            <tr>
                                <td><strong>Message/Notes</strong></td>
                                <td>${registration.message}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <div class="venue-box">
                            <h3>📍 Workshop Venue</h3>
                            <p>Lil Sculpr Clay Academy<br>
                            468 A, C Sector, 2nd Street, AE Block<br>
                            Anna Nagar West Extension, Chennai - 600101</p>
                            <a href="${GOOGLE_MAPS}" class="cta-button" target="_blank">View on Google Maps</a>
                        </div>
                        
                        <div class="stat-box">
                            <h3>📊 Registration Summary</h3>
                            <p>• Registration completed successfully</p>
                            <p>• Email confirmation sent to: ${registration.email}</p>
                            <p>• Workshop preparation required</p>
                            <p>• Parent contact available for follow-up</p>
                        </div>
                        
                        <div style="margin: 30px 0;">
                            <a href="${WEBSITE_URL}/admin/registrations/${registration.registrationId}" class="cta-button">View Full Details</a>
                            <a href="mailto:${registration.email}" class="cta-button" style="background: linear-gradient(to right, #3498db, #2980b9);">Email Parent</a>
                            <a href="tel:${registration.phone}" class="cta-button" style="background: linear-gradient(to right, #9b59b6, #8e44ad);">Call Parent</a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Lil Sculpr Admin Notification System</strong></p>
                        <p>Contact Support: ${EMAIL_SUPPORT} | ${PHONE_NUMBER}</p>
                        <p style="color: #95a5a6; font-size: 12px; margin-top: 10px;">
                            This is an automated notification. Do not reply to this email.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // ==================== OTHER EMAIL TYPES ====================

    async sendPaymentFailureNotification(toEmail, data) {
        try {
            const { EMAIL_SUPPORT, PHONE_NUMBER, WEBSITE_URL } = this.constants;
            
            const mailOptions = {
                from: `"Lil Sculpr Clay Academy" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: toEmail,
                subject: '⚠️ Payment Failed - Republic Day Special Workshop Registration',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; background: #f9f9f9; padding: 20px; }
                            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            .header { background: #e74c3c; color: white; padding: 30px; text-align: center; }
                            .content { padding: 30px; }
                            .cta-button { display: inline-block; background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                            .info-box { background: #fff3cd; border: 2px solid #ffd54f; border-radius: 8px; padding: 20px; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Payment Processing Failed</h1>
                            </div>
                            <div class="content">
                                <p>Dear ${data.parentName},</p>
                                <p>We encountered an issue while processing your payment for <strong>${data.childName}'s</strong> Republic Day Special Workshop registration.</p>
                                
                                <div class="info-box">
                                    <p><strong>Registration ID:</strong> ${data.registrationId}</p>
                                    <p><strong>Selected Date:</strong> ${data.date}</p>
                                    <p><strong>Selected Time:</strong> ${data.batchTime}</p>
                                    <p><strong>Error:</strong> ${data.error || 'Payment processing failed. Please try again.'}</p>
                                </div>
                                
                                <p>Your spot is temporarily reserved. Please complete your payment within the next 15 minutes to secure your registration.</p>
                                
                                <div style="text-align: center;">
                                    <a href="${data.retryUrl || '#'}" class="cta-button">🔄 Retry Payment Now</a>
                                </div>
                                
                                <p style="margin-top: 30px;">If you need assistance, please contact us:</p>
                                <p>📞 Phone: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a><br>
                                📧 Email: <a href="mailto:${EMAIL_SUPPORT}">${EMAIL_SUPPORT}</a></p>
                                
                                <p>Best regards,<br><strong>The Lil Sculpr Team</strong></p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Payment failure notification sent to: ${toEmail}`);
            
            return { 
                success: true,
                messageId: info.messageId 
            };
            
        } catch (error) {
            console.error('❌ Payment failure email error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendWorkshopReminder(toEmail, data) {
        try {
            const { GOOGLE_MAPS, PHONE_NUMBER } = this.constants;
            
            const mailOptions = {
                from: `"Lil Sculpr Clay Academy" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: toEmail,
                subject: '📅 Workshop Reminder - Starts Tomorrow!',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; background: #f9f9f9; padding: 20px; }
                            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            .header { background: #3498db; color: white; padding: 30px; text-align: center; }
                            .content { padding: 30px; }
                            .reminder-box { background: #e8f4fc; border: 2px solid #3498db; border-radius: 8px; padding: 20px; margin: 20px 0; }
                            .instructions { background: #fff8e1; border: 2px solid #ffd54f; border-radius: 8px; padding: 20px; margin: 20px 0; }
                            .cta-button { display: inline-block; background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Workshop Reminder</h1>
                                <p>See you tomorrow! 🎨</p>
                            </div>
                            <div class="content">
                                <p>Dear ${data.parentName},</p>
                                <p>This is a friendly reminder that <strong>${data.childName}</strong> is registered for our Republic Day Special Workshop <strong>tomorrow</strong>!</p>
                                
                                <div class="reminder-box">
                                    <h3>📅 Workshop Details</h3>
                                    <p><strong>Date:</strong> ${data.date}</p>
                                    <p><strong>Time:</strong> ${data.batchTime}</p>
                                    <p><strong>Registration ID:</strong> ${data.registrationId}</p>
                                </div>
                                
                                <div class="instructions">
                                    <h3>📍 Venue Information</h3>
                                    <p><strong>Lil Sculpr Clay Academy</strong><br>
                                    468 A, C Sector, 2nd Street, AE Block<br>
                                    Anna Nagar West Extension, Chennai - 600101</p>
                                    
                                    <div style="text-align: center; margin: 20px 0;">
                                        <a href="${GOOGLE_MAPS}" class="cta-button" target="_blank">📍 Get Directions</a>
                                    </div>
                                    
                                    <h3>📝 What to Bring/Remember:</h3>
                                    <ul>
                                        <li>Arrive <strong>15 minutes before</strong> the workshop start time</li>
                                        <li>Carry this confirmation email (digital or print)</li>
                                        <li>Wear comfortable clothing that can get messy</li>
                                        <li>All art materials will be provided</li>
                                        <li>Carry a water bottle for your child</li>
                                        <li>Free parking available at the venue</li>
                                    </ul>
                                </div>
                                
                                <p>We're excited to create wonderful winter memories with your child! ❄️🎄</p>
                                
                                <p>For any last-minute queries, call us at: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a></p>
                                
                                <p>Warm regards,<br><strong>The Lil Sculpr Team</strong></p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Workshop reminder sent to: ${toEmail}`);
            
            return { 
                success: true,
                messageId: info.messageId 
            };
            
        } catch (error) {
            console.error('❌ Workshop reminder error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendRegistrationExpiredNotification(toEmail, data) {
        try {
            const { EMAIL_SUPPORT, PHONE_NUMBER, WEBSITE_URL } = this.constants;
            
            const mailOptions = {
                from: `"Lil Sculpr Clay Academy" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: toEmail,
                subject: '⏰ Registration Expired - Republic Day Special Workshop',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; background: #f9f9f9; padding: 20px; }
                            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            .header { background: #f39c12; color: white; padding: 30px; text-align: center; }
                            .content { padding: 30px; }
                            .expired-box { background: #fff3cd; border: 2px solid #ffd54f; border-radius: 8px; padding: 20px; margin: 20px 0; }
                            .cta-button { display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Registration Expired</h1>
                            </div>
                            <div class="content">
                                <p>Dear ${data.parentName},</p>
                                <p>Your registration for <strong>${data.childName}'s</strong> Republic Day Special Workshop has expired because the payment was not completed within the 15-minute time limit.</p>
                                
                                <div class="expired-box">
                                    <p><strong>Registration ID:</strong> ${data.registrationId}</p>
                                    <p><strong>Selected Date:</strong> ${data.date}</p>
                                    <p><strong>Selected Time:</strong> ${data.batchTime}</p>
                                    <p><strong>Status:</strong> <span style="color: #e74c3c; font-weight: bold;">EXPIRED</span></p>
                                </div>
                                
                                <p>The slot has been released for other participants. If you still wish to register, please check availability and register again.</p>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${WEBSITE_URL}/special-offer-register.html" class="cta-button">🔄 Check Availability & Register Again</a>
                                </div>
                                
                                <p>If you have any questions or need assistance, please contact us:</p>
                                <p>📞 Phone: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a><br>
                                📧 Email: <a href="mailto:${EMAIL_SUPPORT}">${EMAIL_SUPPORT}</a></p>
                                
                                <p>We hope to see you at our workshops soon!</p>
                                
                                <p>Best regards,<br><strong>The Lil Sculpr Team</strong></p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Registration expired notification sent to: ${toEmail}`);
            
            return { 
                success: true,
                messageId: info.messageId 
            };
            
        } catch (error) {
            console.error('❌ Expired notification error:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== HELPER METHODS ====================

    extractTimeFromBatch(batchString) {
        const timeMatch = batchString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*–\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (timeMatch) {
            return `${timeMatch[1]} – ${timeMatch[2]}`;
        }
        return batchString;
    }

    formatShortDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    getEmailAttachments() {
        const attachments = [];
        
        try {
            const logoPath = path.join(__dirname, '../assets/logo.png');
            attachments.push({
                filename: 'logo.png',
                path: logoPath,
                cid: 'logo'
            });
        } catch (error) {
            console.log('Logo not found, skipping attachment');
        }
        
        return attachments;
    }

    async sendTestEmail(toEmail) {
        try {
            const testData = {
                parentName: 'Test Parent',
                childName: 'Test Child',
                batch: 'Republic Day Special Workshop 🎄 ⌚ 10:00 AM – 11:30 AM',
                batchTime: '10:00 AM – 11:30 AM',
                date: 'December 20, 2024 (Thursday)',
                shortDate: '20 Dec 2024',
                registrationId: 'TEST_' + Date.now().toString().slice(-8),
                paymentId: 'TEST_PAY_' + Date.now().toString().slice(-8),
                amount: '199',
                paymentDate: new Date().toLocaleDateString('en-IN'),
                paymentTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            };

            return await this.sendRegistrationConfirmation(toEmail, testData);
            
        } catch (error) {
            console.error('Test email error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();