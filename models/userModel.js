const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us tour name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email.'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email.'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  }, // setting the standard avatar photo as default
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'], // kind of possible users in this app
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password.'],
    minLength: 8,
    select: false, // password wont show up in any output
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password!'],
    // this validation only works on CREATE and SAVE!
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// implementing the encryption: the pre-save middleware runs between getting the data and saving it to the database, which is the perfect time to manipulate the data
userSchema.pre('save', async function (next) {
  // we only want to encrypt the password if its field has actually been manipulated (created or updated); if it hasnt been manipulated, then just call next
  if (!this.isModified('password')) return next();
  // hash the password with the cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  // delete the passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

// if we didnt modify the password property of if the document is new, dont manipulate the passwordChangedAt
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // putting this passwordChanged one second in the past will then ensure that the token is always created after the password has been changed.
  next();
});

// something that will happen before a query and that query will be 'find' (which is why this is a query middleware); its written like that because its looking for words or strings that starts with find
userSchema.pre(/^find/, function (next) {
  // this points to the current query ----- finding only documents that active is set to true
  this.find({ active: { $ne: false } });
  next();
});

// this function will check if the given password is the same as the one stored in the document
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// checking if the user has changed the password
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp; // not changed means that the day or the time at which the token was issued is less than the changed timestamp
  }

  // false means NOT changed
  return false;
};

// creating a token as a reset password so the user can use it to create a new real password, in case he has forgotten
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // setting the time the token will be available
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // sending the token
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
