// services/freeWorkshopEmailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// ─── Transporter ────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
});

// ─── Shared CSS/Base for HTML emails ────────────────────────────────────────
const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f7fa;
        color: #1f2937;
        -webkit-font-smoothing: antialiased;
    }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header {
        background: linear-gradient(135deg, #FF6B00 0%, #FF9800 60%, #FFC107 100%);
        padding: 40px 36px 32px;
        text-align: center;
        position: relative;
    }
    .header .emoji-row { font-size: 40px; margin-bottom: 12px; }
    .header h1 { color: #fff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
    .header p { color: rgba(255,255,255,0.9); font-size: 14px; }
    .badge {
        display: inline-block;
        background: #fff;
        color: #FF6B00;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        padding: 4px 14px;
        border-radius: 20px;
        margin-bottom: 16px;
    }
    .body { padding: 36px; }
    .greeting { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .intro { font-size: 15px; color: #4b5563; line-height: 1.7; margin-bottom: 28px; }

    /* Details card */
    .details-card {
        background: linear-gradient(135deg, #fff9f0, #fff3e0);
        border: 1.5px solid #ffd54f;
        border-radius: 14px;
        padding: 24px 28px;
        margin-bottom: 24px;
    }
    .details-card h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #FF6B00; font-weight: 700; margin-bottom: 16px; }
    .detail-row { padding: 10px 0; border-bottom: 1px solid #ffe0b2; }
    .detail-row:last-child { border-bottom: none; padding-bottom: 0; }
    .detail-label { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .detail-value { font-size: 15px; font-weight: 700; color: #111827; }

    /* CTA */
    .cta-section { text-align: center; margin: 28px 0; }
    .cta-btn {
        display: inline-block;
        background: linear-gradient(135deg, #FF6B00, #FF9800);
        color: #ffffff !important;
        text-decoration: none;
        font-size: 16px;
        font-weight: 700;
        padding: 14px 36px;
        border-radius: 50px;
        box-shadow: 0 6px 20px rgba(255, 107, 0, 0.35);
        letter-spacing: 0.3px;
    }

    /* Info box */
    .info-box {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        padding: 18px 20px;
        margin-bottom: 24px;
    }
    .info-box p { font-size: 14px; color: #166534; line-height: 1.7; }
    .info-box strong { color: #14532d; }

    /* Warning box */
    .warn-box {
        background: #fefce8;
        border: 1px solid #fde68a;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 24px;
    }
    .warn-box p { font-size: 13px; color: #92400e; line-height: 1.7; }

    /* Divider */
    .divider { height: 1px; background: #f3f4f6; margin: 24px 0; }

    /* Footer */
    .footer { background: #f9fafb; padding: 24px 36px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.7; }
    .footer a { color: #FF6B00; text-decoration: none; }
    .social-links { margin: 14px 0; }
    .social-links a { display: inline-block; margin: 0 6px; color: #6b7280; text-decoration: none; font-size: 12px; }

    /* Admin table */
    .admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .admin-table th { background: #f3f4f6; padding: 10px 14px; text-align: left; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .admin-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; color: #1f2937; }
    .admin-table tr:last-child td { border-bottom: none; }
    .admin-table tr:nth-child(even) td { background: #f9fafb; }
`;

// ─── 1. Parent Confirmation Email ────────────────────────────────────────────
const sendParentConfirmationEmail = async (data) => {
    const { parentName, email, phone, childName, childAge } = data;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Free Workshop Registration Confirmed!</title>
        <style>${baseStyles}</style>
    </head>
    <body style="background:#f5f7fa; padding: 24px 0;">
        <div class="wrapper">

            <!-- Header -->
            <div class="header">
                <div class="badge">Registration Confirmed ✓</div>
                <div class="emoji-row">🐧🎨</div>
                <h1>You're In! See You on 28 June!</h1>
                <p>Free Online Clay Modelling Workshop for Kids</p>
            </div>

            <!-- Body -->
            <div class="body">
                <p class="greeting">Dear ${parentName},</p>
                <p class="intro">
                    We're thrilled to confirm that <strong>${childName}</strong> has been successfully registered for our
                    <strong>Free Online Clay Modelling Workshop</strong>! 🎉<br><br>
                    Get ready for a fun-filled, creative hour that your child will absolutely love!
                </p>

                <!-- Registration Details Card -->
                <div class="details-card">
                    <h3>📋 Registration Details</h3>
                    <div class="detail-row">
                        <div class="detail-label">Child's Name</div>
                        <div class="detail-value">${childName} (Age ${childAge})</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Parent Name</div>
                        <div class="detail-value">${parentName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Workshop Date</div>
                        <div class="detail-value">28 June 2026 (Sunday)</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Session Time</div>
                        <div class="detail-value">11:00 AM – 12:00 PM (IST)</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mode</div>
                        <div class="detail-value">Online Live Session — FREE</div>
                    </div>
                </div>

                <!-- Green Info Box -->
                <div class="info-box">
                    <p>
                        📎 <strong>What's Next?</strong><br>
                        The workshop link will be shared with you closer to the date on
                        <strong>${email}</strong> and <strong>${phone}</strong>. Please keep an eye on your inbox and WhatsApp.
                    </p>
                </div>

                <!-- Yellow Reminder Box -->
                <div class="warn-box">
                    <p>
                        ⏰ <strong>Reminder:</strong> Please ensure your child is ready 5 minutes before the session starts.
                        Keep some basic materials handy — our instructor will guide everything from scratch!
                    </p>
                </div>

                <!-- CTA -->
                <div class="cta-section">
                    <a href="https://www.lilsculpr.com" class="cta-btn">Visit Lil Sculpr Website →</a>
                </div>

                <div class="divider"></div>

                <p style="font-size:14px; color:#6b7280; line-height:1.7;">
                    If you have any questions, feel free to reach us at
                    <a href="mailto:lilsculpr@gmail.com" style="color:#FF6B00;">lilsculpr@gmail.com</a>
                    or WhatsApp us at
                    <a href="https://wa.me/919600443185" style="color:#FF6B00;">+91 96 00 44 31 85</a>.
                </p>
            </div>

            <!-- Footer -->
            <div class="footer">
                <div class="social-links">
                    <a href="https://www.instagram.com/lilsculpr/">Instagram</a> |
                    <a href="https://www.facebook.com/profile.php?id=61583300934216">Facebook</a> |
                    <a href="https://www.lilsculpr.com">Website</a>
                </div>
                <p>
                    © 2026 Lil Sculpr Kids Clay Modelling Academy<br>
                    468 A, C Sector, 2nd Street, AE Block, Anna Nagar West Extension, Chennai – 600101<br>
                    <a href="https://www.lilsculpr.com/privacy-policy.html">Privacy Policy</a> ·
                    <a href="https://www.lilsculpr.com/terms-and-conditions.html">Terms</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;

    await transporter.sendMail({
        from: `"Lil Sculpr Clay Academy 🎨" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `✅ Registration Confirmed — Free Clay Workshop on 28 June! 🐧`,
        html
    });

    console.log(`✅ Parent confirmation email sent to ${email}`);
};

// ─── 2. Admin Notification Email ─────────────────────────────────────────────
const sendAdminNotificationEmail = async (data, slotsRemaining) => {
    const { parentName, email, phone, childName, childAge, createdAt } = data;
    const registeredAt = new Date(createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Free Workshop Registration</title>
        <style>${baseStyles}</style>
    </head>
    <body style="background:#f5f7fa; padding: 24px 0;">
        <div class="wrapper">

            <!-- Header -->
            <div class="header" style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);">
                <div class="badge" style="color:#1e40af;">New Registration 🔔</div>
                <div class="emoji-row">📋</div>
                <h1 style="font-size:22px;">Free Workshop — New Registrant</h1>
                <p>A new child has been registered for the 28 June workshop</p>
            </div>

            <!-- Body -->
            <div class="body">
                <p class="greeting">Hey Admin 👋</p>
                <p class="intro">
                    A new registration just came in for the <strong>Free Online Clay Modelling Workshop</strong>.
                    Here are the full details:
                </p>

                <!-- Slots Alert -->
                <div class="info-box" style="background:${slotsRemaining <= 10 ? '#fef2f2' : '#f0fdf4'}; border-color:${slotsRemaining <= 10 ? '#fecaca' : '#bbf7d0'};">
                    <p style="color:${slotsRemaining <= 10 ? '#991b1b' : '#166534'};">
                        ${slotsRemaining <= 0
                            ? '🔴 <strong>WORKSHOP IS FULLY BOOKED!</strong> All 50 seats are taken.'
                            : slotsRemaining <= 10
                            ? `⚠️ <strong>Only ${slotsRemaining} seats remaining</strong> out of 50 total.`
                            : `🟢 <strong>${slotsRemaining} seats remaining</strong> out of 50 total.`}
                    </p>
                </div>

                <!-- Registrant Details -->
                <div class="details-card">
                    <h3>📋 Registrant Details</h3>
                    <table class="admin-table">
                        <tr>
                            <th>Field</th>
                            <th>Value</th>
                        </tr>
                        <tr><td>Parent Name</td><td><strong>${parentName}</strong></td></tr>
                        <tr><td>Child's Name</td><td><strong>${childName}</strong></td></tr>
                        <tr><td>Child's Age</td><td>${childAge} years</td></tr>
                        <tr><td>Phone</td><td><a href="tel:${phone}" style="color:#FF6B00;">${phone}</a></td></tr>
                        <tr><td>Email</td><td><a href="mailto:${email}" style="color:#FF6B00;">${email}</a></td></tr>
                        <tr><td>Registered At</td><td>${registeredAt} IST</td></tr>
                        <tr><td>Slots Remaining</td><td><strong style="color:${slotsRemaining <= 10 ? '#dc2626' : '#16a34a'}">${slotsRemaining} / 50</strong></td></tr>
                    </table>
                </div>

                <!-- WhatsApp Quick Reply -->
                <div class="cta-section">
                    <a href="https://wa.me/91${phone.replace(/^0/, '')}" class="cta-btn" style="background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 6px 20px rgba(34,197,94,0.35);">
                        💬 WhatsApp ${parentName}
                    </a>
                </div>

            </div>

            <!-- Footer -->
            <div class="footer">
                <p>
                    This is an automated notification from the Lil Sculpr backend.<br>
                    <a href="https://backend.lilsculpr.com/api/free-workshop">View All Registrations →</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;

    await transporter.sendMail({
        from: `"Lil Sculpr System 🤖" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER, // sends to lilsculpr@gmail.com
        subject: `🔔 New Free Workshop Registration — ${childName} (${50 - slotsRemaining}/50 filled)`,
        html
    });

    console.log(`✅ Admin notification email sent to ${process.env.EMAIL_USER}`);
};

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
    sendParentConfirmationEmail,
    sendAdminNotificationEmail
};
