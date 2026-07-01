const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS  // Your Gmail App Password
    }
});

// Send invitation email
async function sendInvitationEmail(inviteeEmail, eventDetails, invitationToken) {
    const inviteLink = `${process.env.CLIENT_URL}/guest/rsvp.html?token=${invitationToken}`;
    
    const mailOptions = {
        from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
        to: inviteeEmail,
        subject: `You're Invited to ${eventDetails.eventName}!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4CAF50;">You're Invited! 🎉</h2>
                
                <p>You've been invited to:</p>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">${eventDetails.eventName}</h3>
                    <p><strong>📅 Date:</strong> ${new Date(eventDetails.date).toLocaleDateString()}</p>
                    <p><strong>🕐 Time:</strong> ${eventDetails.time}</p>
                    <p><strong>📍 Venue:</strong> ${eventDetails.venueName}</p>
                </div>
                
               
                
               
                
               
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                
                <p style="color: #999; font-size: 12px;">
                </p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { sendInvitationEmail };