import mongoose from 'mongoose';

const coinSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true,
    unique: true
  },
  coinType: {
    type: String,
    required: true,
    unique: true
  },
  decimals: {
    type: Number,
    required: true,
    min: 0,
    max: 18
  },
  totalSupply: {
    type: String, // Using string to handle large numbers
    default: '0'
  },
  circulatingSupply: {
    type: String,
    default: '0'
  },
  burnedAmount: {
    type: String,
    default: '0'
  },
  mintedAmount: {
    type: String,
    default: '0'
  },
  metadata: {
    description: String,
    website: String,
    logoUrl: String,
    whitepaper: String,
    socialLinks: {
      twitter: String,
      telegram: String,
      discord: String,
      github: String
    }
  },
  priceData: {
    currentPrice: {
      type: Number,
      default: 0
    },
    priceChange24h: {
      type: Number,
      default: 0
    },
    volume24h: {
      type: Number,
      default: 0
    },
    marketCap: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  vaultConfig: {
    isVaultEnabled: {
      type: Boolean,
      default: false
    },
    minDepositAmount: {
      type: String,
      default: '0'
    },
    maxDepositAmount: {
      type: String,
      default: '0'
    },
    depositFee: {
      type: Number,
      default: 0,
      min: 0,
      max: 100 // Percentage
    },
    withdrawalFee: {
      type: Number,
      default: 0,
      min: 0,
      max: 100 // Percentage
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isNative: {
    type: Boolean,
    default: false
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
coinSchema.index({ isActive: 1 });
coinSchema.index({ 'vaultConfig.isVaultEnabled': 1 });

// Virtual for formatted supply
coinSchema.virtual('formattedSupply').get(function() {
  const supply = BigInt(this.totalSupply || '0');
  const divisor = BigInt(10 ** this.decimals);
  return (Number(supply) / Number(divisor)).toFixed(this.decimals);
});

// Virtual for burn rate
coinSchema.virtual('burnRate').get(function() {
  const total = BigInt(this.totalSupply || '0');
  const burned = BigInt(this.burnedAmount || '0');
  if (total === 0n) return 0;
  return (Number(burned) / Number(total)) * 100;
});

// Static method to get supported vault coins
coinSchema.statics.getVaultCoins = function() {
  return this.find({ 
    'vaultConfig.isVaultEnabled': true,
    isActive: true 
  }).sort({ symbol: 1 });
};

// Static method to update coin supply
coinSchema.statics.updateSupply = async function(symbol, supplyData) {
  return this.findOneAndUpdate(
    { symbol: symbol.toUpperCase() },
    {
      $set: {
        totalSupply: supplyData.totalSupply || '0',
        circulatingSupply: supplyData.circulatingSupply || '0',
        burnedAmount: supplyData.burnedAmount || '0',
        mintedAmount: supplyData.mintedAmount || '0',
        updatedAt: new Date()
      }
    },
    { new: true }
  );
};

// Instance method to burn tokens
coinSchema.methods.burnTokens = async function(amount) {
  const currentBurned = BigInt(this.burnedAmount || '0');
  const burnAmount = BigInt(amount);
  
  this.burnedAmount = (currentBurned + burnAmount).toString();
  this.updatedAt = new Date();
  
  return this.save();
};

// Instance method to mint tokens
coinSchema.methods.mintTokens = async function(amount) {
  const currentMinted = BigInt(this.mintedAmount || '0');
  const mintAmount = BigInt(amount);
  
  this.mintedAmount = (currentMinted + mintAmount).toString();
  this.updatedAt = new Date();
  
  return this.save();
};

export default mongoose.model('Coin', coinSchema);