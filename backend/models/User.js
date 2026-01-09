import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{64}$/.test(v);
      },
      message: 'Invalid wallet address format'
    }
  },
  publicKey: {
    type: String,
    required: true
  },
  ansName: {
    type: String,
    default: null
  },
  profile: {
    displayName: {
      type: String,
      maxlength: 50
    },
    avatar: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      maxlength: 200
    }
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  stats: {
    totalDeposits: {
      type: Number,
      default: 0
    },
    totalWithdrawals: {
      type: Number,
      default: 0
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    firstTransactionAt: {
      type: Date,
      default: null
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance (walletAddress already has unique: true which creates an index)
userSchema.index({ 'stats.lastActiveAt': -1 });
userSchema.index({ createdAt: -1 });

// Virtual for user ID (using wallet address as unique identifier)
userSchema.virtual('id').get(function() {
  return this.walletAddress;
});

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.isNew) {
    this.createdAt = new Date();
  }
  next();
});

// Static method to find or create user
userSchema.statics.findOrCreate = async function(walletData) {
  let user = await this.findOne({ walletAddress: walletData.walletAddress.toLowerCase() });
  
  if (!user) {
    user = new this({
      walletAddress: walletData.walletAddress.toLowerCase(),
      publicKey: walletData.publicKey,
      ansName: walletData.ansName || null
    });
    await user.save();
  } else {
    // Update last active time
    user.stats.lastActiveAt = new Date();
    await user.save();
  }
  
  return user;
};

// Instance method to update activity
userSchema.methods.updateActivity = async function() {
  this.stats.lastActiveAt = new Date();
  return this.save();
};

export default mongoose.model('User', userSchema);