const bcrypt = require('bcrypt');
const { User } = require('../models'); // assuming models/index.js exports User
const nodemailer = require('nodemailer');
require('dotenv').config();

const saltRounds = 10;

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// GET /login
exports.getLogin = (req, res) => {
  res.render('login', { message: null });
};

// POST /login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.render('login', { message: 'Invalid credentials!' });

    if (!user.is_verified) {
      return res.render('login', { message: 'Please verify your email first.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { message: 'Invalid credentials!' });

    req.session.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
    };

    res.redirect('/feed');
  } catch (error) {
    console.error('[POST /login] Login error:', error);
    res.render('login', { message: 'Error during login.' });
  }
};

// GET /signup
exports.getSignup = (req, res) => {
  res.render('signup', { message: null });
};

// POST /signup
exports.postSignup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.render('signup', { message: 'Email already registered!' });

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const token = require('crypto').randomBytes(32).toString('hex');

    await User.create({
      name,
      email,
      password: hashedPassword,
      verification_token: token,
      is_verified: false,
    });

    const link = `${process.env.BASE_URL}/verify-email?token=${token}`;
    await transporter.sendMail({
      from: `"Sherubtse artsPortal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email',
      html: `<h3>Hello ${full_name},</h3><p>Please verify your email by clicking below:</p><a href="${link}">Verify Email</a>`,
    });

    res.render('signup-success', { fullName: full_name });
  } catch (error) {
    console.error('[POST /signup] Error:', error);
    res.render('signup', { message: 'Error during signup.' });
  }
};

// GET /verify-email
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({ where: { verification_token: token } });
    if (!user) return res.send('❌ Invalid or expired verification link.');

    user.is_verified = true;
    user.verification_token = null;
    await user.save();

    res.send('✅ Email verified successfully. You can now log in.');
  } catch (error) {
    console.error('[GET /verify-email] Error:', error);
    res.send('❌ Verification failed.');
  }
};

// GET /forgot-password
exports.getForgotPassword = (req, res) => {
  res.render('forgot-password', { message: null });
};

// POST /forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Show same message regardless to avoid user enumeration
      return res.render('forgot-password', { message: 'If the email exists, a reset link has been sent.' });
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    user.reset_token = resetToken;
    user.reset_token_expiry = expiry;
    await user.save();

    const resetLink = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: `"Sherubtse Arts Club" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello ${user.full_name},</p>
        <p>You requested to reset your password. Click the link below to reset it. This link will expire in 1 hour.</p>
        <a href="${resetLink}" style="padding:10px 20px;background-color:#6366f1;color:white;text-decoration:none;border-radius:5px;">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    res.render('forgot-password', { message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('[POST /forgot-password] Error:', error);
    res.render('forgot-password', { message: 'Something went wrong. Please try again.' });
  }
};

// GET /reset-password
exports.getResetPassword = (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.send('Invalid or missing password reset token.');
  }

  res.render('reset-password', { token, message: null });
};

// POST /reset-password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const now = new Date();

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expiry: { [require('sequelize').Op.gt]: now },
      },
    });

    if (!user) {
      return res.render('reset-password', { token, message: 'Invalid or expired reset token.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;
    user.reset_token = null;
    user.reset_token_expiry = null;

    await user.save();

    res.render('reset-password', { token: null, message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('[POST /reset-password] Error:', error);
    res.render('reset-password', { token, message: 'Something went wrong. Please try again.' });
  }
};

// GET /logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[GET /logout] Error destroying session:', err);
    res.redirect('/login');
  });
};
