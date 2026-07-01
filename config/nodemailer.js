
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');


dotenv.config();



  
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail', // Default to 'gmail' if not set
  auth: {
  user: process.env.EMAIL_USER,
   pass: process.env.EMAIL_PASS,
  },
  //If not using a well-known service, uncomment and configure host/port/secure:
  host: process.env.EMAIL_HOST,
   port: process.env.EMAIL_PORT,
   secure: process.env.EMAIL_SECURE === 'true',
});

// Verify connection configuration (optional, but good for debugging)
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ Nodemailer connection error:', error.message);
    console.error('   Check your EMAIL_USER and EMAIL_PASS in .env file');
  } else {
    console.log('✓ Nodemailer configured successfully, ready to send emails');
    console.log('  Using email:', process.env.EMAIL_USER);
  }
});

// IMPORTANT: Export the transporter object
module.exports = transporter;