 
const transporter = require('../config/nodemailer'); // Our configured Nodemailer transporter
const dotenv = require('dotenv');

// Load environment variables (ensure EMAIL_USER is available)
dotenv.config();

/**
 * Sends an email using the configured Nodemailer transporter.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject line of the email.
 * @param {string} htmlContent - The HTML body of the email.
 * @returns {object} An object indicating success or failure, with messageId or error.
 */
const sendEmail = async (to, subject, htmlContent) => {
  const mailOptions = {
    from: process.env.EMAIL_USER, // The sender's email address from .env
    to: to,                      // 's email
    subject: subject,            // Email subject
    html: htmlContent,           // HTML content of the email
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    // Log the actual error, but return a more general message to the client
    return { success: false, error: error.message || 'Failed to send email' };
  }
};

module.exports = sendEmail;