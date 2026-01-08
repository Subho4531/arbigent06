import mongoose from 'mongoose';

const agenticLogSchema = new mongoose.Schema({
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
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  agentType: {
    type: String,
    required: true,
    enum: ['portfolio_manager', 'risk_analyzer', 'yield_optimizer', 'rebalancer', 'liquidator', 'arbitrage', 'market_maker'],
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['analyze', 'recommend', 'execute', 'monitor', 'alert', 'rebalance', 'optimize', 'liquidate'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['initiated', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'initiated',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  input: {
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    context: {
      portfolioValue: Number,
      riskScore: Number,
      marketConditions: String,
      userPreferences: mongoose.Schema.Types.Mixed
    },
    triggers: [{
      type: String,
      value: mongoose.Schema.Types.Mixed,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  output: {
    recommendations: [{
      type: String,
      action: String,
      coinSymbol: String,
      amount: String,
      reasoning: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      expectedReturn: Number,
      riskLevel: String
    }],
    analysis: {
      summary: String,
      insights: [String],
      warnings: [String],
      metrics: mongoose.Schema.Types.Mixed
    },
    executedActions: [{
      action: String,
      transactionHash: String,
      amount: String,
      coinSymbol: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      success: Boolean,
      error: String
    }]
  },
  performance: {
    executionTime: {
      type: Number, // in milliseconds
      default: 0
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 1
    },
    profitability: {
      type: Number,
      default: 0
    },
    gasUsed: {
      type: String,
      default: '0'
    }
  },
  metadata: {
    modelVersion: String,
    algorithmVersion: String,
    dataSourcesUsed: [String],
    marketDataTimestamp: Date,
    computeResources: {
      cpuTime: Number,
      memoryUsed: Number,
      networkCalls: Number
    }
  },
  error: {
    code: String,
    message: String,
    stack: String,
    details: mongoose.Schema.Types.Mixed
  },
  parentLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgenticLog',
    index: true
  },
  childLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgenticLog'
  }],
  relatedTransactions: [{
    type: String, // transaction hash
    index: true
  }],
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
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
agenticLogSchema.index({ walletAddress: 1, agentType: 1 });
agenticLogSchema.index({ walletAddress: 1, startedAt: -1 });
agenticLogSchema.index({ sessionId: 1, startedAt: -1 });
agenticLogSchema.index({ agentType: 1, action: 1, status: 1 });
agenticLogSchema.index({ status: 1, priority: 1, startedAt: -1 });

// Virtual for execution duration
agenticLogSchema.virtual('duration').get(function() {
  if (!this.completedAt) return null;
  return this.completedAt.getTime() - this.startedAt.getTime();
});

// Virtual for success rate
agenticLogSchema.virtual('successRate').get(function() {
  const total = this.output.executedActions?.length || 0;
  if (total === 0) return null;
  const successful = this.output.executedActions.filter(action => action.success).length;
  return (successful / total) * 100;
});

// Static method to create agentic log
agenticLogSchema.statics.createLog = async function(logData) {
  const log = new this({
    walletAddress: logData.walletAddress.toLowerCase(),
    sessionId: logData.sessionId,
    agentType: logData.agentType,
    action: logData.action,
    status: logData.status || 'initiated',
    priority: logData.priority || 'medium',
    input: logData.input,
    parentLogId: logData.parentLogId || null,
    metadata: logData.metadata || {}
  });
  
  return log.save();
};

// Static method to update log status
agenticLogSchema.statics.updateStatus = async function(logId, status, output = {}, error = null) {
  const updateData = {
    status,
    updatedAt: new Date()
  };
  
  if (output && Object.keys(output).length > 0) {
    updateData.output = output;
  }
  
  if (error) {
    updateData.error = error;
  }
  
  if (status === 'completed' || status === 'failed') {
    updateData.completedAt = new Date();
  }
  
  return this.findByIdAndUpdate(logId, { $set: updateData }, { new: true });
};

// Static method to get agent performance stats
agenticLogSchema.statics.getAgentStats = async function(walletAddress, agentType, timeframe = '30d') {
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
        agentType,
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgExecutionTime: { $avg: '$performance.executionTime' },
        avgAccuracy: { $avg: '$performance.accuracy' },
        totalProfitability: { $sum: '$performance.profitability' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to get user agent activity
agenticLogSchema.statics.getUserActivity = function(walletAddress, options = {}) {
  const {
    agentType,
    action,
    status,
    priority,
    limit = 50,
    skip = 0,
    sortBy = 'startedAt',
    sortOrder = -1
  } = options;
  
  const query = { walletAddress: walletAddress.toLowerCase() };
  
  if (agentType) query.agentType = agentType;
  if (action) query.action = action;
  if (status) query.status = status;
  if (priority) query.priority = priority;
  
  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip)
    .populate('parentLogId', 'agentType action status')
    .populate('childLogs', 'agentType action status');
};

// Instance method to add child log
agenticLogSchema.methods.addChildLog = async function(childLogId) {
  if (!this.childLogs.includes(childLogId)) {
    this.childLogs.push(childLogId);
    this.updatedAt = new Date();
    return this.save();
  }
  return this;
};

// Instance method to add executed action
agenticLogSchema.methods.addExecutedAction = async function(actionData) {
  if (!this.output.executedActions) {
    this.output.executedActions = [];
  }
  
  this.output.executedActions.push({
    action: actionData.action,
    transactionHash: actionData.transactionHash,
    amount: actionData.amount,
    coinSymbol: actionData.coinSymbol,
    timestamp: new Date(),
    success: actionData.success,
    error: actionData.error || null
  });
  
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to update performance metrics
agenticLogSchema.methods.updatePerformance = async function(performanceData) {
  this.performance = {
    ...this.performance,
    ...performanceData
  };
  this.updatedAt = new Date();
  return this.save();
};

export default mongoose.model('AgenticLog', agenticLogSchema);