/**
 * USER MODEL
 * ==========
 * Defines the "shape" of a user document in MongoDB.
 * 
 * KEY CONCEPTS:
 * 
 * 1. Mongoose Schema: Like a blueprint for your data. It says:
 *    "A user MUST have a username, email, password. It CAN have an avatar."
 *    MongoDB is "schemaless" by default, but Mongoose adds structure.
 * 
 * 2. pre('save') hook: A "middleware" that runs BEFORE saving to the database.
 *    We use it to hash the password so we NEVER store plain text passwords.
 *    - `this.isModified('password')` prevents re-hashing on every save
 *    - bcrypt.hash(password, 12) — the "12" is the salt rounds (cost factor)
 * 
 * 3. select: false on password: Tells Mongoose to EXCLUDE the password field
 *    from ALL queries by default. You must explicitly do .select('+password')
 *    when you actually need to compare passwords (during login).
 * 
 * 4. comparePassword() instance method: Securely compares a plain text
 *    password against the stored hash. bcrypt handles the comparison
 *    without ever revealing the original password.
 * 
 * 5. timestamps: true: Automatically adds `createdAt` and `updatedAt` fields.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,         // No two users can have the same username
    trim: true,           // Removes whitespace from both ends
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,      // Converts to lowercase before saving
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,        // ← IMPORTANT: Never returned in queries by default
  },
  avatar: {
    type: String,
    default: '',          // Users can upload a profile picture later
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],  // Only these values are allowed
    default: 'offline',
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });  // Adds createdAt and updatedAt automatically

/**
 * PRE-SAVE HOOK
 * Runs before every .save() call. If the password was modified,
 * hash it with bcrypt. The "12" means 2^12 = 4096 rounds of hashing —
 * high enough to be secure, low enough to not be slow.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

/**
 * INSTANCE METHOD
 * Called on a user document: user.comparePassword('myPassword123')
 * Returns true if the plain text matches the stored hash.
 * bcrypt.compare() is timing-safe (prevents timing attacks).
 */
userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
