// API Service for backend integration
import { API_CONFIG } from '@/config/network';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Backend API configuration
const BACKEND_BASE_URL = API_CONFIG.backendUrl;

// External Arbitrage API configuration  
const ARBITRAGE_API_BASE_URL = API_CONFIG.arbitrageApiUrl;

// User profile interface
export interface UserProfile {
  walletAddress: string;
  publicKey: string;
  ansName?: string;
  profile?: {
    displayName?: string;
    avatar?: string;
    bio?: string;
  };
  stats?: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalTransactions: number;
    lastActiveAt: string;
  };
}

// Vault balance interface
export interface VaultBalance {
  coinSymbol: string;
  balance: string;
  lockedBalance: string;
  earnedRewards: string;
  lastUpdated: string;
}

// Vault interface
export interface Vault {
  walletAddress: string;
  balances: VaultBalance[];
  totalValueLocked: number;
  totalRewardsEarned: number;
  riskScore: number;
  settings: {
    autoCompound: boolean;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
    notifications: {
      deposits: boolean;
      withdrawals: boolean;
      rewards: boolean;
      riskAlerts: boolean;
    };
  };
  stats: {
    totalDeposits: number;
    totalWithdrawals: number;
    netDeposits: number;
    totalTransactions: number;
  };
}

// Transaction log interface
export interface TransactionLog {
  transactionHash: string;
  type: 'deposit' | 'withdrawal' | 'burn' | 'mint' | 'reward' | 'fee' | 'transfer';
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  coinSymbol: string;
  amount: string;
  amountFormatted: number;
  fees: {
    networkFee: string;
    platformFee: string;
    totalFee: string;
  };
  vault: {
    balanceBefore: string;
    balanceAfter: string;
    burnAmount?: string;
    mintAmount?: string;
  };
  createdAt: string;
  confirmedAt?: string;
}

// Market data interfaces
export interface MarketData {
  status: string;
  timestamp: string;
  base_currency: string;
  chains: Array<{
    chain: string;
    current_price: string;
    gas_fees: string;
    tvl_usd: string;
    market_cap: string;
    fully_diluted_valuation: string;
    volume_24h: string;
  }>;
  data_source: string;
}

// Arbitrage opportunity interface
export interface ArbitrageOpportunity {
  route: {
    from_pair: string;
    to_pair: string;
    from_dex: string;
    to_dex: string;
    trade_amount: number;
  };
  profitability: {
    is_profitable: boolean;
    price_difference_percent: number;
    gross_profit_usd: number;
    total_costs_usd: number;
    net_profit_usd: number;
    profit_margin_percent: number;
    roi_percent: number;
  };
  charges: {
    dex_fees: {
      from_dex_fee_percent: number;
      to_dex_fee_percent: number;
      from_fee_amount_usd: number;
      to_fee_amount_usd: number;
      total_trading_fees_usd: number;
    };
    gas_fees: {
      total_gas_cost_apt: number;
      total_gas_cost_usd: number;
    };
    slippage: {
      estimated_slippage_percent: number;
      estimated_slippage_cost_usd: number;
    };
  };
  recommendation: string;
  risk_level: string;
}

class ApiService {
  // ============= BACKEND API METHODS =============

  // Create or get user profile
  async createUserProfile(walletAddress: string, publicKey: string, ansName?: string): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          publicKey,
          ansName
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create user profile' };
      }

      return { success: true, data: data.user };
    } catch (error) {
      console.error('Create user profile error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get user vault
  async getUserVault(walletAddress: string): Promise<ApiResponse<Vault>> {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/vault/${walletAddress}`);
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to get vault' };
      }

      return { success: true, data: data.vault };
    } catch (error) {
      console.error('Get vault error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Deposit to vault
  async depositToVault(
    walletAddress: string, 
    coinSymbol: string, 
    amount: string, 
    transactionHash: string
  ): Promise<ApiResponse<{ vault: Vault; transactionLog: TransactionLog }>> {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/vault/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          coinSymbol,
          amount,
          transactionHash
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to deposit' };
      }

      return { success: true, data: { vault: data.vault, transactionLog: data.transactionLog } };
    } catch (error) {
      console.error('Deposit error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Withdraw from vault
  async withdrawFromVault(
    walletAddress: string, 
    coinSymbol: string, 
    amount: string, 
    transactionHash: string
  ): Promise<ApiResponse<{ vault: Vault; transactionLog: TransactionLog }>> {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/vault/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          coinSymbol,
          amount,
          transactionHash
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to withdraw' };
      }

      return { success: true, data: { vault: data.vault, transactionLog: data.transactionLog } };
    } catch (error) {
      console.error('Withdraw error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get transaction history
  async getTransactionHistory(
    walletAddress: string,
    options?: {
      type?: string;
      status?: string;
      coinSymbol?: string;
      limit?: number;
      skip?: number;
    }
  ): Promise<ApiResponse<TransactionLog[]>> {
    try {
      const params = new URLSearchParams();
      if (options?.type) params.append('type', options.type);
      if (options?.status) params.append('status', options.status);
      if (options?.coinSymbol) params.append('coinSymbol', options.coinSymbol);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.skip) params.append('skip', options.skip.toString());

      const response = await fetch(`${BACKEND_BASE_URL}/transactions/${walletAddress}?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to get transactions' };
      }

      return { success: true, data: data.transactions };
    } catch (error) {
      console.error('Get transactions error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // ============= EXTERNAL ARBITRAGE API METHODS =============

  // Get market overview
  async getMarketOverview(): Promise<ApiResponse<MarketData>> {
    try {
      const response = await fetch(`${ARBITRAGE_API_BASE_URL}/market/overview`);
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: 'Failed to get market data' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Market overview error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Check profitability
  async checkProfitability(params: {
    from_token: string;
    to_token?: string;
    trade_amount?: number;
    amount_usd?: number;
    amount_apt?: number;
    dex_fees?: Record<string, number>;
  }): Promise<ApiResponse<ArbitrageOpportunity>> {
    try {
      const response = await fetch(`${ARBITRAGE_API_BASE_URL}/arbitrage/isprofitable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: 'Failed to check profitability' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Check profitability error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Find arbitrage opportunities
  async findArbitrageOpportunities(params: {
    trade_amount?: number;
    amount_usd?: number;
    amount_apt?: number;
    dex_fees?: Record<string, number>;
  }): Promise<ApiResponse<{ opportunities: { top_opportunities: ArbitrageOpportunity[] } }>> {
    try {
      const response = await fetch(`${ARBITRAGE_API_BASE_URL}/arbitrage/possibilities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: 'Failed to find opportunities' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Find opportunities error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get current prices from market data
  async getCurrentPrices(): Promise<ApiResponse<Record<string, { price: string; change: string; isPositive: boolean }>>> {
    try {
      const marketResponse = await this.getMarketOverview();
      
      if (!marketResponse.success || !marketResponse.data) {
        return { success: false, error: 'Failed to get market data' };
      }

      const prices: Record<string, { price: string; change: string; isPositive: boolean }> = {};
      
      marketResponse.data.chains.forEach(chain => {
        const symbol = chain.chain.toUpperCase();
        prices[symbol] = {
          price: `$${parseFloat(chain.current_price).toFixed(2)}`,
          change: '+0.0%', // Market API doesn't provide 24h change, would need additional endpoint
          isPositive: true
        };
      });

      return { success: true, data: prices };
    } catch (error) {
      console.error('Get current prices error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default ApiService;