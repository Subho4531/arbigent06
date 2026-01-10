import mongoose from 'mongoose';

const vaultBalanceSchema = new mongoose.Schema({
  coinSymbol: {
    type: String,
    required: true,
    uppercase: true
  },
  balance: {
    type: String, // Using string to handle large numbers
    required: true,
    default: '0'
  },
  lockedBalance: {
    type: String,
    default: '0'
  },
  earnedRewards: {
    type: String,
    default: '0'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const vaultSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{64}$/.test(v);
      },
      message: 'Invalid wallet address format'
    }
  },
  balances: [vaultBalanceSchema],
  totalValueLocked: {
    type: Number,
    default: 0
  },
  totalRewardsEarned: {
    type: Number,
    default: 0
  },
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  strategies: [{
    strategyId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    allocation: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true
    },
    performance: {
      totalReturn: {
        type: Number,
        default: 0
      },
      apy: {
        type: Number,
        default: 0
      },
      sharpeRatio: {
        type: Number,
        default: 0
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    autoCompound: {
      type: Boolean,
      default: true
    },
    riskTolerance: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive'],
      default: 'moderate'
    },
    rebalanceFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    notifications: {
      deposits: {
        type: Boolean,
        default: true
      },
      withdrawals: {
        type: Boolean,
        default: true
      },
      rewards: {
        type: Boolean,
        default: true
      },
      riskAlerts: {
        type: Boolean,
        default: true
      }
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
    netDeposits: {
      type: Number,
      default: 0
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    averageHoldingPeriod: {
      type: Number,
      default: 0 // in days
    },
    bestPerformingStrategy: {
      type: String,
      default: null
    }
  },
  arbitrageStats: {
    totalProfitLoss: {
      type: Number,
      default: 0
    },
    totalTrades: {
      type: Number,
      default: 0
    },
    totalSessions: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    },
    bestTrade: {
      type: Number,
      default: 0
    },
    worstTrade: {
      type: Number,
      default: 0
    },
    totalGasFees: {
      type: Number,
      default: 0
    },
    totalSlippage: {
      type: Number,
      default: 0
    },
    lastSessionProfit: {
      type: Number,
      default: 0
    },
    lastSessionTrades: {
      type: Number,
      default: 0
    },
    lastSessionDate: {
      type: Date,
      default: null
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

// Indexes for performance
vaultSchema.index({ walletAddress: 1 });
vaultSchema.index({ 'balances.coinSymbol': 1 });
vaultSchema.index({ totalValueLocked: -1 });
vaultSchema.index({ createdAt: -1 });
vaultSchema.index({ updatedAt: -1 });

// Virtual for total portfolio value
vaultSchema.virtual('portfolioValue').get(function() {
  return this.balances.reduce((total, balance) => {
    // This would need to be calculated with current prices
    return total + parseFloat(balance.balance || '0');
  }, 0);
});

// Static method to find or create vault
vaultSchema.statics.findOrCreate = async function(walletAddress) {
  let vault = await this.findOne({ walletAddress: walletAddress.toLowerCase() });
  
  if (!vault) {
    // Create vault with default balances for supported coins
    const defaultBalances = [
      {
        coinSymbol: 'APT',
        balance: '0',
        lockedBalance: '0',
        earnedRewards: '0',
        lastUpdated: new Date()
      },
      {
        coinSymbol: 'USDC',
        balance: '0',
        lockedBalance: '0',
        earnedRewards: '0',
        lastUpdated: new Date()
      },
      {
        coinSymbol: 'USDT',
        balance: '0',
        lockedBalance: '0',
        earnedRewards: '0',
        lastUpdated: new Date()
      }
    ];
    
    vault = new this({
      walletAddress: walletAddress.toLowerCase(),
      balances: defaultBalances
    });
    await vault.save();
  }
  
  return vault;
};

// Instance method to get balance for a specific coin
vaultSchema.methods.getCoinBalance = function(coinSymbol) {
  const balance = this.balances.find(b => b.coinSymbol === coinSymbol.toUpperCase());
  return balance ? balance.balance : '0';
};

// Instance method to update coin balance
vaultSchema.methods.updateCoinBalance = async function(coinSymbol, newBalance, isDeposit = true) {
  const symbol = coinSymbol.toUpperCase();
  let balanceEntry = this.balances.find(b => b.coinSymbol === symbol);
  
  if (!balanceEntry) {
    balanceEntry = {
      coinSymbol: symbol,
      balance: '0',
      lockedBalance: '0',
      earnedRewards: '0',
      lastUpdated: new Date()
    };
    this.balances.push(balanceEntry);
  }
  
  const currentBalance = BigInt(balanceEntry.balance || '0');
  const changeAmount = BigInt(newBalance);
  
  if (isDeposit) {
    balanceEntry.balance = (currentBalance + changeAmount).toString();
    this.stats.totalDeposits += parseFloat(newBalance);
  } else {
    balanceEntry.balance = (currentBalance - changeAmount).toString();
    this.stats.totalWithdrawals += parseFloat(newBalance);
  }
  
  balanceEntry.lastUpdated = new Date();
  this.stats.netDeposits = this.stats.totalDeposits - this.stats.totalWithdrawals;
  this.stats.totalTransactions += 1;
  this.updatedAt = new Date();
  
  return this.save();
};

// Instance method to lock/unlock balance
vaultSchema.methods.lockBalance = async function(coinSymbol, amount, lock = true) {
  const symbol = coinSymbol.toUpperCase();
  const balanceEntry = this.balances.find(b => b.coinSymbol === symbol);
  
  if (!balanceEntry) {
    throw new Error(`No balance found for ${symbol}`);
  }
  
  const currentLocked = BigInt(balanceEntry.lockedBalance || '0');
  const currentAvailable = BigInt(balanceEntry.balance || '0');
  const lockAmount = BigInt(amount);
  
  if (lock) {
    if (lockAmount > currentAvailable) {
      throw new Error('Insufficient available balance to lock');
    }
    balanceEntry.lockedBalance = (currentLocked + lockAmount).toString();
    balanceEntry.balance = (currentAvailable - lockAmount).toString();
  } else {
    if (lockAmount > currentLocked) {
      throw new Error('Insufficient locked balance to unlock');
    }
    balanceEntry.lockedBalance = (currentLocked - lockAmount).toString();
    balanceEntry.balance = (currentAvailable + lockAmount).toString();
  }
  
  balanceEntry.lastUpdated = new Date();
  this.updatedAt = new Date();
  
  return this.save();
};

// Instance method to add rewards
vaultSchema.methods.addRewards = async function(coinSymbol, rewardAmount) {
  const symbol = coinSymbol.toUpperCase();
  let balanceEntry = this.balances.find(b => b.coinSymbol === symbol);
  
  if (!balanceEntry) {
    balanceEntry = {
      coinSymbol: symbol,
      balance: '0',
      lockedBalance: '0',
      earnedRewards: '0',
      lastUpdated: new Date()
    };
    this.balances.push(balanceEntry);
  }
  
  const currentRewards = BigInt(balanceEntry.earnedRewards || '0');
  const rewards = BigInt(rewardAmount);
  
  balanceEntry.earnedRewards = (currentRewards + rewards).toString();
  balanceEntry.lastUpdated = new Date();
  
  this.totalRewardsEarned += parseFloat(rewardAmount);
  this.updatedAt = new Date();
  
  return this.save();
};

// Instance method to update arbitrage stats
vaultSchema.methods.updateArbitrageStats = async function(sessionStats) {
  const {
    sessionProfit,
    sessionTrades,
    sessionGasFees,
    sessionSlippage,
    bestTrade,
    worstTrade
  } = sessionStats;


  // Update cumulative stats
  this.arbitrageStats.totalProfitLoss += sessionProfit;
  this.arbitrageStats.totalTrades += sessionTrades;
  this.arbitrageStats.totalSessions += 1;
  this.arbitrageStats.totalGasFees += sessionGasFees;
  this.arbitrageStats.totalSlippage += sessionSlippage;

  // Update best/worst trades
  if (bestTrade > this.arbitrageStats.bestTrade) {
    this.arbitrageStats.bestTrade = bestTrade;
  }
  if (worstTrade < this.arbitrageStats.worstTrade || this.arbitrageStats.worstTrade === 0) {
    this.arbitrageStats.worstTrade = worstTrade;
  }

  // Update last session info
  this.arbitrageStats.lastSessionProfit = sessionProfit;
  this.arbitrageStats.lastSessionTrades = sessionTrades;
  this.arbitrageStats.lastSessionDate = new Date();

  // Calculate win rate (assuming positive profit = win)
  if (this.arbitrageStats.totalTrades > 0) {
    // This is a simplified win rate calculation
    // In a real scenario, you'd track individual trade outcomes
    const estimatedWins = Math.max(0, this.arbitrageStats.totalTrades * 0.6); // Estimate based on profitability
    this.arbitrageStats.winRate = (estimatedWins / this.arbitrageStats.totalTrades) * 100;
  }


  this.updatedAt = new Date();
  const result = await this.save();
  
  return result;
};

// Static method to get top vaults by TVL
vaultSchema.statics.getTopVaults = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ totalValueLocked: -1 })
    .limit(limit)
    .populate('walletAddress');
};

export default mongoose.model('Vault', vaultSchema);