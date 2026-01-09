import express from 'express';
import cors from 'cors';
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import User from './models/User.js';
import Vault from './models/Vault.js';
import Coin from './models/Coin.js';
import TransactionLog from './models/TransactionLog.js';
import AgenticLog from './models/AgenticLog.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);

// Load faucet account from environment variable
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
if (!FAUCET_PRIVATE_KEY) {
  console.error('FAUCET_PRIVATE_KEY not set in .env file');
  process.exit(1);
}

const faucetAccount = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(FAUCET_PRIVATE_KEY)
});

console.log('Faucet account:', faucetAccount.accountAddress.toString());

// Rate limiting
const requestLog = new Map();
const RATE_LIMIT_MINUTES = 60;
const MAX_REQUESTS_PER_HOUR = 5;

function checkRateLimit(address) {
  const now = Date.now();
  const requests = requestLog.get(address) || [];
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_MINUTES * 60 * 1000);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }
  
  recentRequests.push(now);
  requestLog.set(address, recentRequests);
  return true;
}

// Faucet endpoint
app.post('/api/faucet', async (req, res) => {
  try {
    const { address, amount = 10000000 } = req.body; // Default 0.1 APT (reduced from 1 APT)
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Check rate limit
    if (!checkRateLimit(address)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Try again in an hour.' 
      });
    }

    // Transfer APT from faucet account
    const transaction = await aptos.transaction.build.simple({
      sender: faucetAccount.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [address, amount],
      },
    });

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: faucetAccount,
      transaction,
    });

    const executedTransaction = await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    res.json({
      success: true,
      txHash: committedTxn.hash,
      amount: amount / 100000000,
      message: `Sent ${amount / 100000000} APT to ${address}`,
    });

  } catch (error) {
    console.error('Faucet error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process faucet request' 
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const balance = await aptos.getAccountAPTAmount({
      accountAddress: faucetAccount.accountAddress,
    });
    
    res.json({
      status: 'ok',
      faucetAddress: faucetAccount.accountAddress.toString(),
      balance: balance / 100000000,
      network: 'testnet',
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============= VAULT API ENDPOINTS =============

// Get or create user profile
app.post('/api/user/profile', async (req, res) => {
  try {
    const { walletAddress, publicKey, ansName } = req.body;
    
    if (!walletAddress || !publicKey) {
      return res.status(400).json({ error: 'Wallet address and public key are required' });
    }
    
    const user = await User.findOrCreate({
      walletAddress,
      publicKey,
      ansName
    });
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user vault
app.get('/api/vault/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    const vault = await Vault.findOrCreate(walletAddress);
    
    res.json({
      success: true,
      vault
    });
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deposit to vault (burns coins, increases vault balance)
app.post('/api/vault/deposit', async (req, res) => {
  try {
    const { walletAddress, coinSymbol, amount, transactionHash } = req.body;
    
    if (!walletAddress || !coinSymbol || !amount || !transactionHash) {
      return res.status(400).json({ 
        error: 'Wallet address, coin symbol, amount, and transaction hash are required' 
      });
    }
    
    // Find or create vault
    const vault = await Vault.findOrCreate(walletAddress);
    
    // Find coin
    const coin = await Coin.findOne({ symbol: coinSymbol.toUpperCase() });
    if (!coin) {
      return res.status(404).json({ error: 'Coin not found' });
    }
    
    // Calculate formatted amount based on decimals
    const decimals = coin.decimals || (coinSymbol.toUpperCase() === 'APT' ? 8 : 6);
    const amountFormatted = parseFloat(amount) / Math.pow(10, decimals);
    
    // Create transaction log
    const transactionLog = await TransactionLog.createLog({
      walletAddress,
      transactionHash,
      type: 'deposit',
      status: 'confirmed',
      coinSymbol,
      amount: amount.toString(),
      amountFormatted: amountFormatted,
      smartContract: {
        contractAddress: coin.contractAddress,
        functionName: 'deposit',
        functionArguments: [amount]
      },
      vault: {
        balanceBefore: vault.getCoinBalance(coinSymbol),
        burnAmount: amount.toString()
      }
    });
    
    // Update vault balance
    await vault.updateCoinBalance(coinSymbol, amount, true);
    
    // Burn coins (simulate smart contract burn)
    await coin.burnTokens(amount);
    
    // Update transaction log with new balance
    await TransactionLog.updateStatus(transactionHash, 'confirmed', {
      'vault.balanceAfter': vault.getCoinBalance(coinSymbol)
    });
    
    res.json({
      success: true,
      message: `Deposited ${amount} ${coinSymbol} to vault`,
      vault,
      transactionLog
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Withdraw from vault (mints coins, decreases vault balance)
app.post('/api/vault/withdraw', async (req, res) => {
  try {
    const { walletAddress, coinSymbol, amount, transactionHash } = req.body;
    
    if (!walletAddress || !coinSymbol || !amount || !transactionHash) {
      return res.status(400).json({ 
        error: 'Wallet address, coin symbol, amount, and transaction hash are required' 
      });
    }
    
    // Find vault
    const vault = await Vault.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }
    
    // Check if sufficient balance
    const currentBalance = BigInt(vault.getCoinBalance(coinSymbol) || '0');
    const withdrawAmount = BigInt(amount);
    
    if (currentBalance < withdrawAmount) {
      return res.status(400).json({ error: 'Insufficient vault balance' });
    }
    
    // Find coin
    const coin = await Coin.findOne({ symbol: coinSymbol.toUpperCase() });
    if (!coin) {
      return res.status(404).json({ error: 'Coin not found' });
    }
    
    // Calculate formatted amount based on decimals
    const decimals = coin.decimals || (coinSymbol.toUpperCase() === 'APT' ? 8 : 6);
    const amountFormatted = parseFloat(amount) / Math.pow(10, decimals);
    
    // Create transaction log
    const transactionLog = await TransactionLog.createLog({
      walletAddress,
      transactionHash,
      type: 'withdrawal',
      status: 'confirmed',
      coinSymbol,
      amount: amount.toString(),
      amountFormatted: amountFormatted,
      smartContract: {
        contractAddress: coin.contractAddress,
        functionName: 'withdraw',
        functionArguments: [amount]
      },
      vault: {
        balanceBefore: vault.getCoinBalance(coinSymbol),
        mintAmount: amount.toString()
      }
    });
    
    // Update vault balance
    await vault.updateCoinBalance(coinSymbol, amount, false);
    
    // Mint coins (simulate smart contract mint)
    await coin.mintTokens(amount);
    
    // Update transaction log with new balance
    await TransactionLog.updateStatus(transactionHash, 'confirmed', {
      'vault.balanceAfter': vault.getCoinBalance(coinSymbol)
    });
    
    res.json({
      success: true,
      message: `Withdrew ${amount} ${coinSymbol} from vault`,
      vault,
      transactionLog
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transaction history
app.get('/api/transactions/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { type, status, coinSymbol, limit = 50, skip = 0 } = req.query;
    
    const transactions = await TransactionLog.getUserHistory(walletAddress, {
      type,
      status,
      coinSymbol,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transaction statistics
app.get('/api/transactions/:walletAddress/stats', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { timeframe = '30d' } = req.query;
    
    const stats = await TransactionLog.getStats(walletAddress, timeframe);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create agentic log
app.post('/api/agents/log', async (req, res) => {
  try {
    const { walletAddress, sessionId, agentType, action, input, priority } = req.body;
    
    if (!walletAddress || !sessionId || !agentType || !action || !input) {
      return res.status(400).json({ 
        error: 'Wallet address, session ID, agent type, action, and input are required' 
      });
    }
    
    const agenticLog = await AgenticLog.createLog({
      walletAddress,
      sessionId,
      agentType,
      action,
      input,
      priority
    });
    
    res.json({
      success: true,
      agenticLog
    });
  } catch (error) {
    console.error('Create agentic log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update agentic log
app.put('/api/agents/log/:logId', async (req, res) => {
  try {
    const { logId } = req.params;
    const { status, output, error } = req.body;
    
    const agenticLog = await AgenticLog.updateStatus(logId, status, output, error);
    
    if (!agenticLog) {
      return res.status(404).json({ error: 'Agentic log not found' });
    }
    
    res.json({
      success: true,
      agenticLog
    });
  } catch (error) {
    console.error('Update agentic log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get agent activity
app.get('/api/agents/:walletAddress/activity', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { agentType, action, status, priority, limit = 50, skip = 0 } = req.query;
    
    const activity = await AgenticLog.getUserActivity(walletAddress, {
      agentType,
      action,
      status,
      priority,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Get agent activity error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get agent performance stats
app.get('/api/agents/:walletAddress/stats/:agentType', async (req, res) => {
  try {
    const { walletAddress, agentType } = req.params;
    const { timeframe = '30d' } = req.query;
    
    const stats = await AgenticLog.getAgentStats(walletAddress, agentType, timeframe);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get supported coins
app.get('/api/coins', async (req, res) => {
  try {
    const coins = await Coin.find({ isActive: true }).sort({ symbol: 1 });
    
    res.json({
      success: true,
      coins
    });
  } catch (error) {
    console.error('Get coins error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vault-enabled coins
app.get('/api/coins/vault', async (req, res) => {
  try {
    const coins = await Coin.getVaultCoins();
    
    res.json({
      success: true,
      coins
    });
  } catch (error) {
    console.error('Get vault coins error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Faucet backend running on port ${PORT}`);
  console.log(`Network: TESTNET`);
});
