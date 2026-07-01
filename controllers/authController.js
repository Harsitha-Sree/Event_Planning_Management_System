const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 


const registerUser = async (req, res) => {
  const { fullName, email, password, role, companyName } = req.body;

  // Basic validation
  if (!fullName || !email || !password || !role) {
    console.log('Register Debug: Missing required fields for registration.');
    return res.status(400).json({ message: 'Please enter all required fields' });
  }

  if (password.length < 6) {
    console.log('Register Debug: Password too short.');
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  // Validate role against allowed values
  const validRoles = ['organizer', 'vendor', 'admin'];
  if (!validRoles.includes(role)) {
    console.log('Register Debug: Invalid user role specified:', role);
    return res.status(400).json({ message: 'Invalid user role specified' });
  }

  if (role === 'vendor' && !companyName) {
      console.log('Register Debug: Company name missing for vendor registration.');
      return res.status(400).json({ message: 'Company name is required for vendor registration' });
  }

  try {
    // Check if user with this email already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('Register Debug: User with this email already exists:', email);
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user based on role and provided data
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      companyName: role === 'vendor' ? companyName : undefined,
    });

    await newUser.save();
    console.log('Register Debug: New user registered successfully:', newUser.email, newUser.role);

    // Respond with success message and user details (excluding password)
    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully.`,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        companyName: newUser.companyName,
      },
    });
  } catch (error) {
    console.error('Register Debug: Server error during registration:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  console.log('--- Debug: Inside loginUser function ---');
  const { email, password } = req.body;
  console.log('Debug: Received email:', email);
  // Do NOT log raw passwords in a production environment! This is for debug only.
  // console.log('Debug: Received password:', password); 

  // Basic validation
  if (!email || !password) {
    console.log('Debug: Login failed - Missing email or password in request body.');
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check for user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`Debug: Login failed - User with email "${email}" not found in database.`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log(`Debug: User found: ${user.email}, Role: ${user.role}, Status: ${user.status}`);

    // Check if user is suspended (prevent login)
    if (user.status === 'suspended') {
        console.log(`Debug: Login failed - Account suspended for ${user.email}`);
        return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }
    // Check if user is 'deleted' (should not be able to log in)
    if (user.status === 'deleted') {
        console.log(`Debug: Login failed - Account deleted/removed for ${user.email}`);
        return res.status(404).json({ message: 'Account not found or has been removed.' });
    }

    // Compare provided password with hashed password in database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Debug: Login failed - Password mismatch for user: ${user.email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log('Debug: Password matched successfully.');

    // Generate JWT token upon successful authentication
    const token = jwt.sign(
      { id: user._id, role: user.role, fullName: user.fullName, email: user.email }, // Payload for the token
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token expires in 1 hour
    );
    console.log('Debug: Token generated. Login successful.');

    // Respond with the token and essential user information
    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        companyName: user.companyName, // Will be undefined for non-vendors
      },
    });
  } catch (error) {
    console.error('Debug: Server error in loginUser:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = {
  registerUser,
  loginUser,
};