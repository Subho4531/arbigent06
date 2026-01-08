import mongoose from 'mongoose';

const transactionLogSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{64}$/.test(v);
      },
      message: 'Invalid wallet address format'
    }
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdrawal', 'burn', 'mint', 'reward', 'fee', 'transfer'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  coinSymbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  amount: {
    type: String, // Using string to handle large numbers
    required: true
  },
  amountFormatted: {
    type: Number,
    required: true
  },
  fees: {
    networkFee: {
      type: String,
      default: '0'
    },
    platformFee: {
      type: String,
      default: '0'
    },
    totalFee: {
      type: String,
      default: '0'
    }
  },
  smartContract: {
    contractAddress: {
      type: String,
      required: true
    },
    functionName: {
      type: String,
      required: true
    },
    functionArguments: [{
      type: mongoose.Schema.Types.Mixed
    }]
  },
  vault: {
    balanceBefore: {
      type: String,
      default: '0'
    },
    balanceAfter: {
      type: String,
      default: '0'
    },
    burnAmount: {
      type: String,
      default: '0'
    },
    mintAmount: {
      type: String,
      default: '0'
    }
  },
  metadata: {
    blockNumber: {
      type: Number,
      index: true
    },
    blockTimestamp: {
      type: Date,
      index: true
    },
    gasUsed: {
      type: String,
      default: '0'
    },
    gasPrice: {
      type: String,
      default: '0'
    },
    fromAddress: String,
    toAddress: String,
    eventLogs: [{
      type: mongoose.Schema.Types.Mixed
    }]
  },
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  retryCount: {
    type: Number,
    default: 0
  },
  confirmedAt: {
    type: Date,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
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

// Compound indexes for performance
transactionLogSchema.index({ walletAddress: 1, type: 1 });
transactionLogSchema.index({ walletAddress: 1, createdAt: -1 });
transactionLogSchema.index({ coinSymbol: 1, type: 1 });
transactionLogSchema.index({ status: 1, createdAt: -1 });
transactionLogSchema.index({ transactionHash: 1, status: 1 });

// Virtual for transaction age
transactionLogSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for formatted amount with decimals
transactionLogSchema.virtual('displayAmount').get(function() {
  return `${this.amountFormatted} ${this.coinSymbol}`;
});

// Static method to create transaction log
transactionLogSchema.statics.createLog = async function(logData) {
  const log = new this({
    walletAddress: logData.walletAddress.toLowerCase(),
    transactionHash: logData.transactionHash,
    type: logData.type,
    status: logData.status || 'pending',
    coinSymbol: logData.coinSymbol.toUpperCase(),
    amount: logData.amount,
    amountFormatted: logData.amountFormatted,
    fees: logData.fees || {},
    smartContract: logData.smartContract,
    vault: logData.vault || {},
    metadata: logData.metadata || {},
    error: logData.error || null
  });
  
  return log.save();
};

// Static method to update transaction status
transactionLogSchema.statics.updateStatus = async function(transactionHash, status, metadata = {}) {
  const updateData = {
    status,
    updatedAt: new Date(),
    ...metadata
  };
  
  if (status === 'confirmed') {
    updateData.confirmedAt = new Date();
  }
  
  return this.findOneAndUpdate(
    { transactionHash },
    { $set: updateData },
    { new: true }
  );
};

// Static method to get user transaction history
transactionLogSchema.statics.getUserHistory = function(walletAddress, options = {}) {
  const {
    type,
    status,
    coinSymbol,
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const query = { walletAddress: walletAddress.toLowerCase() };
  
  if (type) query.type = type;
  if (status) query.status = status;
  if (coinSymbol) query.coinSymbol = coinSymbol.toUpperCase();
  
  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip);
};

// Static method to get transaction statistics
transactionLogSchema.statics.getStats = async function(walletAddress, timeframe = '30d') {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0);
  }
  
  const pipeline = [
    {
      $match: {
        walletAddress: walletAddress.toLowerCase(),
        createdAt: { $gte: startDate },
        status: 'confirmed'
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amountFormatted' },
        totalFees: { $sum: { $toDouble: '$fees.totalFee' } }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Instance method to mark as failed
transactionLogSchema.methods.markAsFailed = async function(error) {
  this.status = 'failed';
  this.error = error;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to retry transaction
transactionLogSchema.methods.retry = async function() {
  this.retryCount += 1;
  this.status = 'pending';
  this.error = null;
  this.updatedAt = new Date();
  return this.save();
};

export default mongoose.model('TransactionLog', transactionLogSchema);