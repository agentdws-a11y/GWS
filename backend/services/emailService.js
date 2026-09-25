const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn(' Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', 
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    console.log('Email transporter configured');
    return transporter;
}

async function sendAdminInviteEmail(toEmail, toName, inviteLink, invitedByName) {
    const transporter = getTransporter();
    
    if (!transporter) {
        console.log('Email not configured - invite link would be sent to:', toEmail);
        console.log('   Link:', inviteLink);
        return { sent: false, reason: 'Email not configured' };
    }

    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
    const companyName = process.env.COMPANY_NAME || 'Hyre.AI';

    const mailOptions = {
        from: `"${companyName}" <${fromEmail}>`,
        to: toEmail,
        subject: `You've been invited to join ${companyName} as an Admin`,
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
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .email-body {
            padding: 40px 30px;
        }
        .email-body h2 {
            color: #333;
            font-size: 20px;
            margin: 0 0 20px 0;
        }
        .email-body p {
            color: #666;
            margin: 0 0 20px 0;
        }
        .invite-box {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .invite-box p {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
        }
        .invite-box p:last-child {
            margin: 0;
        }
        .invite-box strong {
            color: #333;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .link-box {
            background-color: #f8f9fa;
            border: 1px solid #e0e0e0;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            word-break: break-all;
        }
        .link-box p {
            margin: 0 0 10px 0;
            font-size: 13px;
            color: #666;
        }
        .link-box code {
            display: block;
            font-size: 12px;
            color: #667eea;
            background-color: white;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
            margin-top: 5px;
        }
        .email-footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
        }
        .email-footer p {
            margin: 0;
            font-size: 13px;
            color: #999;
        }
        .expiry-notice {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .expiry-notice p {
            margin: 0;
            font-size: 14px;
            color: #856404;
        }
        .security-notice {
            font-size: 13px;
            color: #999;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🎉 Admin Invitation</h1>
        </div>
        
        <div class="email-body">
            <h2>Hi ${toName || 'there'},</h2>
            
            <p>Great news! You've been invited to join <strong>${companyName}</strong> as an HR Admin.</p>
            
            <div class="invite-box">
                <p><strong>Invited by:</strong> ${invitedByName}</p>
                <p><strong>Role:</strong> HR Admin</p>
                <p><strong>Access Level:</strong> Full hiring platform access</p>
            </div>
            
            <p>As an HR Admin, you'll be able to:</p>
            <ul style="color: #666; margin: 10px 0 20px 20px;">
                <li>Post and manage job vacancies</li>
                <li>Review and screen applications</li>
                <li>Schedule and conduct interviews</li>
                <li>Send offer letters to candidates</li>
                <li>Invite other HR admins</li>
            </ul>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" class="cta-button">Accept Invitation & Register</a>
            </p>
            
            <div class="expiry-notice">
                <p>⏰ <strong>Important:</strong> This invitation expires in 7 days. Please complete your registration before it expires.</p>
            </div>
            
            <div class="link-box">
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <code>${inviteLink}</code>
            </div>
            
            <div class="security-notice">
                <p><strong>Security Notice:</strong> This invitation link is unique to you and can only be used once. If you didn't expect this invitation or have any concerns, please contact ${invitedByName} or your IT administrator.</p>
            </div>
        </div>
        
        <div class="email-footer">
            <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            <p style="margin-top: 10px;">This is an automated email. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
        `,
        text: `
Admin Invitation

Hi ${toName || 'there'},

You've been invited to join ${companyName} as an HR Admin by ${invitedByName}.

Complete your registration by visiting this link:
${inviteLink}

This invitation expires in 7 days.

As an HR Admin, you'll be able to:
- Post and manage job vacancies
- Review and screen applications
- Schedule and conduct interviews
- Send offer letters to candidates
- Invite other HR admins

If you didn't expect this invitation, please contact ${invitedByName}.

---
${companyName} - ${new Date().getFullYear()}
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✓ Admin invite email sent to:', toEmail);
        console.log('  Message ID:', info.messageId);
        return { sent: true, messageId: info.messageId };
    } catch (error) {
        console.error('✗ Failed to send admin invite email:', error.message);
        return { sent: false, error: error.message };
    }
}

module.exports = {
    sendAdminInviteEmail
};
