// ArbiGent - Autonomous Arbitrage Agent Service
// Triangular Arbitrage: from_token → mid_token → from_token (profit in from_token)
import { apiService, ArbitrageOpportunity } from './ApiService';

export type LogType = 'INFO' | 'SCAN' | 'EXECUTE' | 'WARNING' | 'ERROR' | 'SUCCESS';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface AgentLog {
  time: string;
  type: LogType;
  message: string;
  detail?: string;
}

export interface AgentConfig {
  minProfitThreshold: number;
  riskTolerance: RiskLevel;
  selectedPair: string;
  maxTradeCap: number;
  allocationPercent: number;
  scalingFactor: number;
  investedAmount?: number; // Optional: Amount in USD to invest per trade (if not set, uses automatic allocation)
}

export interface VaultState {
  APT: number;
  USDC: number;
  USDT: number;
}

export interface AgentState {
  isRunning: boolean;
  currentAllocation: number;
  totalProfit: number;
  tradesExecuted: number;
  tradesSkipped: number;
  startTime: Date | null;
  lastTradeTime: Date | null;
  totalGasFees: number;
  totalSlippage: number;
  totalCosts: number;
}

// Triangular arbitrage routes
// AUTO mode: switches chains (USDC→APT→USDC, then APT→USDT→APT, etc.)
// Specific pairs: stay on same route (USDC→APT always does USDC→APT→USDC)
interface ArbitrageRoute {
  name: string;
  fromToken: keyof VaultState;
  midToken: keyof VaultState;
  toToken: keyof VaultState; // Final token we receive
  apiFromToken: string;
  apiToToken: string;
}

// Routes for specific pair selections (non-circular, actual arbitrage)
const ARBITRAGE_ROUTES: Record<string, ArbitrageRoute> = {
  'USDC_APT': {
    name: 'USDC → USDT → APT',
    fromToken: 'USDC',
    midToken: 'USDT',
    toToken: 'APT',   // We end up with APT
    apiFromToken: 'usdc',
    apiToToken: 'apt',
  },
  'APT_USDT': {
    name: 'APT → USDC → USDT',
    fromToken: 'APT',
    midToken: 'USDC',
    toToken: 'USDT',  // We end up with USDT
    apiFromToken: 'apt',
    apiToToken: 'usdt',
  },
  'USDC_USDT': {
    name: 'USDC → APT → USDT',
    fromToken: 'USDC',
    midToken: 'APT',
    toToken: 'USDT',  // We end up with USDT
    apiFromToken: 'usdc',
    apiToToken: 'usdt',
  },
};

// All routes for AUTO mode - cycles through different chains
const AUTO_ROUTES = ['USDC_APT', 'APT_USDT', 'USDC_USDT'];

// Minimum token balance to continue trading (in USD)
const MIN_BALANCE_USD = 0.10;

// Risk level constraints
const RISK_CONSTRAINTS: Record<RiskLevel, { maxTrade: number; gasLimit: number }> = {
  LOW: { maxTrade: 2500, gasLimit: 0.003 },
  MEDIUM: { maxTrade: 5000, gasLimit: 0.005 },
  HIGH: { maxTrade: 10000, gasLimit: 0.01 },
  VERY_HIGH: { maxTrade: 1000000, gasLimit: 0.05 },
};

class ArbiGentService {
  private isRunning = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private logs: AgentLog[] = [];
  private onLogCallback: ((log: AgentLog) => void) | null = null;
  private onStateChangeCallback: ((state: AgentState) => void) | null = null;
  private onVaultUpdateCallback: ((balances: VaultState) => void) | null = null;
  private onStatsUpdateCallback: (() => void) | null = null;
  private currentAutoRouteIndex = 0;
  private walletAddress: string | null = null;

  // Track current allocation - starts at 10%, goes to 50% on success
  private currentAllocationPercent = 0.10;
  private consecutiveFailures = 0;
  private lastSavedProfit = 0; // Track what profit has already been saved
  private lastSavedTrades = 0; // Track what trades have already been saved
  private lastSavedGasFees = 0; // Track what gas fees have already been saved
  private lastSavedSlippage = 0; // Track what slippage has already been saved

  private state: AgentState = {
    isRunning: false,
    currentAllocation: 0.10,
    totalProfit: 0,
    tradesExecuted: 0,
    tradesSkipped: 0,
    startTime: null,
    lastTradeTime: null,
    totalGasFees: 0,
    totalSlippage: 0,
    totalCosts: 0,
  };

  private config: AgentConfig = {
    minProfitThreshold: 0.0001,
    riskTolerance: 'MEDIUM',
    selectedPair: 'AUTO',
    maxTradeCap: 5000,
    allocationPercent: 0.10,
    scalingFactor: 1.05,
    // investedAmount is optional - when not set, uses automatic allocation
  };

  private vaultBalances: VaultState = { APT: 0, USDC: 0, USDT: 0 };
  private livePrices: Record<string, number> = { APT: 0, USDC: 1, USDT: 1 };

  onLog(callback: (log: AgentLog) => void) {
    this.onLogCallback = callback;
  }

  onStateChange(callback: (state: AgentState) => void) {
    this.onStateChangeCallback = callback;
  }

  onVaultUpdate(callback: (balances: VaultState) => void) {
    this.onVaultUpdateCallback = callback;
  }

  onStatsUpdate(callback: () => void) {
    this.onStatsUpdateCallback = callback;
  }

  updateConfig(newConfig: Partial<AgentConfig>) {
    this.config = { ...this.config, ...newConfig };
    const riskConstraints = RISK_CONSTRAINTS[this.config.riskTolerance];
    this.config.maxTradeCap = riskConstraints.maxTrade;
  }

  updateVaultBalances(balances: VaultState) {
    this.vaultBalances = { ...balances };
  }

  updatePrices(prices: Record<string, number>) {
    this.livePrices = { ...prices };
  }

  setWalletAddress(address: string) {
    this.walletAddress = address;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getVaultBalances(): VaultState {
    return { ...this.vaultBalances };
  }

  getLogs(): AgentLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  private addLog(type: LogType, message: string, detail?: string) {
    const log: AgentLog = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
      message,
      detail,
    };

    this.logs.push(log);
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }

    if (this.onLogCallback) {
      this.onLogCallback(log);
    }
  }

  private updateState(updates: Partial<AgentState>) {
    this.state = { ...this.state, ...updates };
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state);
    }
  }

  private notifyVaultUpdate() {
    if (this.onVaultUpdateCallback) {
      this.onVaultUpdateCallback(this.vaultBalances);
    }
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentAutoRouteIndex = 0;
    this.consecutiveFailures = 0;

    // Reset tracking variables for new session
    this.lastSavedProfit = 0;
    this.lastSavedTrades = 0;
    this.lastSavedGasFees = 0;
    this.lastSavedSlippage = 0;

    // Initialize allocation based on mode
    if (this.config.investedAmount) {
      // Fixed investment mode: allocation doesn't matter, we use exact amount
      this.currentAllocationPercent = 1.00; // Set to 100% for display purposes only
    } else {
      // Automatic allocation mode: start at 10%
      this.currentAllocationPercent = 0.10;
    }

    this.updateState({
      isRunning: true,
      startTime: new Date(),
      currentAllocation: this.currentAllocationPercent,
      totalGasFees: 0,
      totalSlippage: 0,
      totalCosts: 0,
      totalProfit: 0,
      tradesExecuted: 0,
      tradesSkipped: 0,
    });

    const modeText = this.config.investedAmount 
      ? `Fixed: $${this.config.investedAmount} per trade (exact amount)`
      : 'Automatic: Dynamic allocation';

    this.addLog('INFO', 'ArbiGent Started',
      `Risk: ${this.config.riskTolerance} | Min Profit: ${this.config.minProfitThreshold}% | Mode: ${modeText}`
    );
    this.addLog('INFO', 'Strategy',
      `${this.config.selectedPair === 'AUTO' ? 'AUTO: Dynamic route selection' : `Fixed: ${this.config.selectedPair}`}`
    );

    this.runLoop();
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.loopInterval) {
      clearTimeout(this.loopInterval);
      this.loopInterval = null;
    }

    // Save final arbitrage stats to MongoDB before stopping
    if (this.state.totalProfit > 0 || this.state.tradesExecuted > 0) {
      await this.saveArbitrageStats();
    }

    this.updateState({ isRunning: false });
    this.addLog('INFO', 'ArbiGent Stopped',
      `Final Session: $${this.state.totalProfit.toFixed(4)} | Trades: ${this.state.tradesExecuted} | Stats saved to total arbitrage`
    );

    // Reset session stats after stopping for clean next start
    this.updateState({
      totalProfit: 0,
      tradesExecuted: 0,
      totalGasFees: 0,
      totalSlippage: 0,
      totalCosts: 0,
    });

    // Reset tracking variables
    this.lastSavedProfit = 0;
    this.lastSavedTrades = 0;
    this.lastSavedGasFees = 0;
    this.lastSavedSlippage = 0;
  }

  private async runLoop() {
    if (!this.isRunning) return;

    try {
      await this.executeCycle();
    } catch (error) {
      this.addLog('ERROR', 'Arbitrage Error', error instanceof Error ? error.message : 'Unknown error');
      console.error('ArbiGent cycle error:', error);
    }

    // Continue if still running
    if (this.isRunning) {
      const delay = 3000 + Math.random() * 3000;
      this.loopInterval = setTimeout(() => this.runLoop(), delay);
    }
  }

  private async executeCycle() {

    // Add market analysis log at the start of each cycle
    this.addLog('INFO', 'Analyzing Market', 'Scanning for arbitrage opportunities across all pairs...');

    // Get the route to check - enhanced with live opportunities in AUTO mode
    let routeKey: string;
    if (this.config.selectedPair === 'AUTO') {
      // In AUTO mode, try to get the most profitable route from live opportunities
      const bestRoute = await this.getBestRouteFromOpportunities();
      if (bestRoute) {
        routeKey = bestRoute;
      } else {
        // Fallback to round-robin
        routeKey = AUTO_ROUTES[this.currentAutoRouteIndex];
        this.currentAutoRouteIndex = (this.currentAutoRouteIndex + 1) % AUTO_ROUTES.length;
      }
    } else {
      routeKey = this.config.selectedPair;
    }

    const route = ARBITRAGE_ROUTES[routeKey];
    if (!route) {
      this.addLog('ERROR', 'Invalid Route', `Route ${routeKey} not found`);
      return;
    }

    // Check if we have enough balance (different logic for fixed vs auto mode)
    const fromBalanceUsd = this.getTokenBalanceUsd(route.fromToken);
    
    if (this.config.investedAmount) {
      // Fixed mode: only stop if balance is insufficient for the fixed amount OR balance is 0
      if (fromBalanceUsd === 0) {
        this.addLog('ERROR', 'Fixed Mode: Zero Balance',
          `${route.fromToken} balance is $0.00 - stopping agent`
        );
        this.stop();
        return;
      }
      
      if (fromBalanceUsd < this.config.investedAmount) {
        this.addLog('ERROR', 'Fixed Mode: Insufficient Balance',
          `Need $${this.config.investedAmount} but only have $${fromBalanceUsd.toFixed(2)} - stopping agent`
        );
        this.stop();
        return;
      }
    } else {
      // Auto mode: only stop if balance is exactly 0
      if (fromBalanceUsd === 0) {
        this.addLog('ERROR', 'Auto Mode: Zero Balance',
          `${route.fromToken} balance is $0.00 - stopping agent`
        );
        this.stop();
        return;
      }
      
      // In auto mode, continue even with low balance (will use percentage allocation)
      if (fromBalanceUsd < MIN_BALANCE_USD) {
        this.addLog('WARNING', 'Auto Mode: Low Balance',
          `${route.fromToken} balance is low ($${fromBalanceUsd.toFixed(4)}) but continuing with percentage allocation`
        );
      }
    }

    // Calculate trade amount
    const tradeAmount = this.calculateTradeAmount(route.fromToken, this.currentAllocationPercent);

    const modeInfo = this.config.investedAmount 
      ? `Fixed Amount: $${tradeAmount.toFixed(2)}`
      : `Trade Amount: $${tradeAmount.toFixed(2)}`;

    this.addLog('SCAN', `Scanning: ${route.name}`, modeInfo);

    if (tradeAmount < 0.01) {
      this.addLog('WARNING', 'Trade Amount Too Low', `$${tradeAmount.toFixed(4)} < $0.01`);
      if (this.config.investedAmount) {
        this.handleUnprofitableFixed(route);
      } else {
        this.handleUnprofitableAutomatic(route);
      }
      return;
    }



    // Check profitability via API
    const opportunity = await this.checkProfitability(route, tradeAmount);

    if (!opportunity) {
      this.addLog('WARNING', 'API Error', 'Could not fetch profitability data');
      return;
    }

    // Log API response details
    const gasCost = opportunity.charges?.gas_fees?.total_gas_cost_usd || 0;
    const slippage = opportunity.charges?.slippage?.estimated_slippage_percent || 0;
    const totalCost = opportunity.charges?.total_costs?.total_fees_usd || opportunity.profitability.total_costs_usd || 0;
    const profitMargin = opportunity.profitability.profit_margin_percent || 0;

    this.addLog('INFO', 'Opportunity Analysis',
      `Profitable: ${opportunity.profitability.is_profitable} | Margin: ${profitMargin.toFixed(4)}%`
    );

    // Check if profitable
    if (opportunity.profitability.is_profitable &&
      profitMargin >= this.config.minProfitThreshold) {

      // Execute the trade
      await this.executeTrade(route, opportunity);

      // Save stats after each successful trade to ensure accumulation
      await this.saveArbitrageStats();

      // Reset failure counter
      this.consecutiveFailures = 0;

      // Handle success based on mode
      if (this.config.investedAmount) {
        // Fixed mode: continue with same fixed amount (no allocation changes)
        this.addLog('SUCCESS', 'Fixed Mode: Trade Successful', 
          `Continuing with fixed amount: $${this.config.investedAmount}`);
      } else {
        // Automatic mode: if we were at 10%, switch to 50% for next trade
        if (this.currentAllocationPercent === 0.10) {
          this.currentAllocationPercent = 0.50;
          this.addLog('SUCCESS', 'Auto Mode: Amount Increased', 'Increasing trade amount for continued trading');
          this.updateState({ currentAllocation: 0.50 });
        }
      }

    } else {
      // Not profitable at current allocation
      if (this.config.investedAmount) {
        this.handleUnprofitableFixed(route);
      } else {
        this.handleUnprofitableAutomatic(route);
      }
    }
  }

  // private handleUnprofitable(route: ArbitrageRoute) {
  //   this.consecutiveFailures++;

  //   if (this.currentAllocationPercent === 0.10) {
  //     // Try 50%
  //     this.addLog('WARNING', 'Not Profitable at 10%', 'Trying 50% allocation...');
  //     this.currentAllocationPercent = 0.50;
  //     this.updateState({ currentAllocation: 0.50 });

  //   } else if (this.currentAllocationPercent === 0.50) {
  //     // Try 80%
  //     this.addLog('WARNING', 'Not Profitable at 50%', 'Trying 80% allocation...');
  //     this.currentAllocationPercent = 0.80;
  //     this.updateState({ currentAllocation: 0.80 });

  //   } else if (this.currentAllocationPercent === 0.80) {
  //     // Try 100%
  //     this.addLog('WARNING', 'Not Profitable at 80%', 'Trying 100% allocation...');
  //     this.currentAllocationPercent = 1.00;
  //     this.updateState({ currentAllocation: 1.00 });

  //   } else {
  //     // Already at 100%, still not profitable
  //     this.addLog('ERROR', 'Not Profitable at 100%', 'No profitable opportunity found');
  //     this.updateState({ tradesSkipped: this.state.tradesSkipped + 1 });

  //     // Reset to 10% for next route
  //     this.currentAllocationPercent = 0.10;
  //     this.updateState({ currentAllocation: 0.10 });

  //     // If too many consecutive failures, consider stopping
  //     if (this.consecutiveFailures >= 12) { // 3 full cycles of all routes
  //       this.addLog('ERROR', 'Too Many Failures', 'Stopping agent after 12 consecutive unprofitable checks');
  //       this.stop();
  //     }
  //   }
  // }

  // Handle unprofitable trades in FIXED investment mode
  private handleUnprofitableFixed(route: ArbitrageRoute) {
    this.consecutiveFailures++;

    this.addLog('WARNING', 'Fixed Mode: Trade Not Profitable', 
      `Trade with $${this.config.investedAmount} on ${route.name} was not profitable`);
    
    this.updateState({ tradesSkipped: this.state.tradesSkipped + 1 });
    
    // In fixed mode, continue to next route instead of stopping
    this.addLog('INFO', 'Fixed Mode: Continuing', 'Checking next trading pair...');
    
    // Only stop after many consecutive failures across all pairs
    if (this.consecutiveFailures >= 20) { // Increased threshold for fixed mode
      this.addLog('ERROR', 'Fixed Mode: Too Many Failures', 
        'Stopping agent after 20 consecutive unprofitable trades across all pairs');
      this.stop();
    }
  }

  // Handle unprofitable trades in AUTOMATIC allocation mode
  private handleUnprofitableAutomatic(route: ArbitrageRoute) {
    const STEP = 0.10;
    const START = 0.20;
    const MAX = 1.00;

    this.consecutiveFailures++;

    // Step UP until 100%
    if (this.currentAllocationPercent < MAX) {
      const nextAllocation = Math.min(
        Number((this.currentAllocationPercent + STEP).toFixed(2)),
        MAX
      );

      this.addLog(
        'WARNING',
        'Auto Mode: Trade Not Profitable',
        'Increasing trade amount and trying again'
      );

      this.currentAllocationPercent = nextAllocation;
      this.updateState({ currentAllocation: nextAllocation });
      return;
    }

    // Failed at maximum amount → SKIP ROUTE
    this.addLog(
      'ERROR',
      'Auto Mode: Trade Failed at Maximum Amount',
      'Skipping route and trying next pair'
    );

    this.updateState({
      tradesSkipped: this.state.tradesSkipped + 1
    });

    // Reset for next route
    this.currentAllocationPercent = START;
    this.updateState({ currentAllocation: START });

    // Optional hard stop if too many failures
    if (this.consecutiveFailures >= 12) {
      this.addLog(
        'ERROR',
        'Auto Mode: Too Many Failures',
        'Stopping agent after 12 consecutive failures'
      );
      this.stop();
    }
  }


  private async getBestRouteFromOpportunities(): Promise<string | null> {
    try {
      // Use current prices for opportunities check
      const currentPrices = [
        {
          apt: this.livePrices.APT?.toString() || "1.8",
          usdc: this.livePrices.USDC?.toString() || "1.0",
          usdt: this.livePrices.USDT?.toString() || "0.98"
        }
      ];

      const response = await apiService.findArbitrageOpportunities({
        trade_amount: 1000, // Use a standard amount for comparison
        current_prices: currentPrices,
        apt_price: this.livePrices.APT?.toString() || "1.8"
      });

      if (response.success && response.data?.opportunities?.top_opportunities) {
        const opportunities = response.data.opportunities.top_opportunities;

        // Filter profitable opportunities above our threshold
        const profitableOpps = opportunities.filter(opp =>
          opp.profitability.is_profitable &&
          opp.profitability.profit_margin_percent >= this.config.minProfitThreshold
        );

        if (profitableOpps.length > 0) {
          // Sort by profit margin and get the best one
          const bestOpp = profitableOpps.sort((a, b) =>
            b.profitability.profit_margin_percent - a.profitability.profit_margin_percent
          )[0];

          // Map API route to our internal route keys
          const fromToken = bestOpp.route.from_pair.split('_')[0].toUpperCase();
          const toToken = bestOpp.route.to_pair.split('_')[1]?.toUpperCase() || 'APT';

          // Find matching route key
          for (const [key, route] of Object.entries(ARBITRAGE_ROUTES)) {
            if (route.fromToken === fromToken && route.toToken === toToken) {
              this.addLog('INFO', 'Best Opportunity',
                `${route.name} - ${(bestOpp.profitability.profit_margin_percent || 0).toFixed(4)}% margin`
              );
              return key;
            }
          }
        }
      }
    } catch (error) {
      this.addLog('WARNING', 'Opportunities Check Failed', 'Using fallback route selection');
    }

    return null;
  }

  private getTokenBalanceUsd(token: keyof VaultState): number {
    const balance = this.vaultBalances[token] || 0;
    const price = this.livePrices[token] || 1;
    return balance * price;
  }

  private calculateTradeAmount(token: keyof VaultState, allocation: number): number {
    if (this.config.investedAmount) {
      // Fixed investment mode: ALWAYS use the exact configured amount (ignore allocation)
      const configuredAmount = this.config.investedAmount;
      const maxAllowed = Math.min(configuredAmount, this.config.maxTradeCap);
      
      // Return the configured amount (balance checking is done in executeCycle)
      return maxAllowed;
    } else {
      // Automatic allocation mode: use percentage-based allocation
      const balanceUsd = this.getTokenBalanceUsd(token);
      return Math.min(balanceUsd * allocation, this.config.maxTradeCap);
    }
  }

  private async checkProfitability(route: ArbitrageRoute, tradeAmount: number): Promise<ArbitrageOpportunity | null> {
    try {
      const response = await apiService.checkProfitability({
        from_token: route.apiFromToken,
        to_token: route.apiToToken,
        trade_amount: tradeAmount,
      });

      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      this.addLog('ERROR', 'API Error', `Failed to check ${route.name}`);
    }
    return null;
  }

  private async executeTrade(route: ArbitrageRoute, opp: ArbitrageOpportunity) {
    const { profitability, charges } = opp;
    const tradeAmountUsd = opp.route.trade_amount;

    const totalCostUsd = charges?.total_costs?.total_fees_usd || profitability.total_costs_usd || 0;
    const gasCostUsd = charges?.gas_fees?.total_gas_cost_usd || 0;
    const slippageCostUsd = charges?.slippage?.estimated_slippage_cost_usd || 0;
    // Use the API's profit calculation directly
    const profitUsd = profitability.net_profit_usd || 0;
    const profitMargin = profitability.profit_margin_percent || 0;

    // Get prices for token calculations
    const fromPrice = this.livePrices[route.fromToken] || 1;
    const toPrice = this.livePrices[route.toToken] || 1;

    // Calculate token amounts for vault updates
    const fromTokenAmount = tradeAmountUsd / fromPrice;
    // For simplicity, assume we get back the original amount plus profit in the target token
    const finalValueUsd = tradeAmountUsd + profitUsd;
    const toTokenAmount = finalValueUsd / toPrice;

    this.addLog('SUCCESS', 'ARBITRAGE EXECUTED', route.name);

    // Update local vault balances
    const oldFromBalance = this.vaultBalances[route.fromToken];
    const oldToBalance = this.vaultBalances[route.toToken];

    // Deduct from_token
    this.vaultBalances[route.fromToken] = Math.max(0, oldFromBalance - fromTokenAmount);

    // Add to_token (including profit)
    this.vaultBalances[route.toToken] = oldToBalance + toTokenAmount;

    // Update vault - deduct from_token and add to_token
    await this.updateVault(route, fromTokenAmount, toTokenAmount);

    this.addLog('SUCCESS', 'Trade Complete',
      `Invested: $${tradeAmountUsd.toFixed(2)} | Profit: +$${profitUsd.toFixed(4)} (${profitMargin.toFixed(4)}%)`
    );

    // Update state with proper profit tracking
    const newTotalProfit = this.state.totalProfit + profitUsd;

    this.updateState({
      totalProfit: newTotalProfit,
      tradesExecuted: this.state.tradesExecuted + 1,
      lastTradeTime: new Date(),
      totalGasFees: this.state.totalGasFees + gasCostUsd,
      totalSlippage: this.state.totalSlippage + slippageCostUsd,
      totalCosts: this.state.totalCosts + totalCostUsd,
    });

    this.notifyVaultUpdate();

    this.addLog('INFO', 'Session Total',
      `Profit: $${newTotalProfit.toFixed(4)} | Trades: ${this.state.tradesExecuted} | Costs: $${this.state.totalCosts.toFixed(4)}`
    );
  }

  // Update vault - deduct from_token and add to_token
  private async updateVault(route: ArbitrageRoute, fromAmount: number, toAmount: number) {
    if (!this.walletAddress) {
      this.addLog('WARNING', 'Vault Update Skipped', 'No wallet address');
      return;
    }

    try {
      // Get decimals for each token
      const fromDecimals = route.fromToken === 'APT' ? 8 : 6;
      const toDecimals = route.toToken === 'APT' ? 8 : 6;

      // Convert to smallest units
      const fromAmountSmallest = Math.floor(fromAmount * Math.pow(10, fromDecimals)).toString();
      const toAmountSmallest = Math.floor(toAmount * Math.pow(10, toDecimals)).toString();

      // Generate mock transaction hashes
      const txHashBase = `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`;

      // Withdraw from_token (deduct from vault)
      const withdrawResponse = await apiService.withdrawFromVault(
        this.walletAddress,
        route.fromToken,
        fromAmountSmallest,
        txHashBase + '_withdraw'
      );

      if (withdrawResponse.success) {
        this.addLog('INFO', 'Vault Deducted',
          `${route.fromToken}: -${fromAmount.toFixed(6)}`
        );
      }

      // Deposit to_token (add to vault)
      const depositResponse = await apiService.depositToVault(
        this.walletAddress,
        route.toToken,
        toAmountSmallest,
        txHashBase + '_deposit'
      );

      if (depositResponse.success) {
        this.addLog('INFO', 'Vault Added',
          `${route.toToken}: +${toAmount.toFixed(6)}`
        );
      }

    } catch (error) {
      this.addLog('ERROR', 'Vault Update Failed', error instanceof Error ? error.message : 'Unknown');
    }
  }

  private async saveArbitrageStats() {

    if (!this.walletAddress) {
      this.addLog('WARNING', 'Stats Save Skipped', 'No wallet address');
      return;
    }

    // Calculate only the NEW profits/trades since last save (delta)
    const newProfit = this.state.totalProfit - this.lastSavedProfit;
    const newTrades = this.state.tradesExecuted - this.lastSavedTrades;
    const newGasFees = this.state.totalGasFees - this.lastSavedGasFees;
    const newSlippage = this.state.totalSlippage - this.lastSavedSlippage;

    // Only save if there are new stats to save
    if (newProfit === 0 && newTrades === 0) {
      return;
    }


    

    try {
      // Calculate best and worst trades (simplified - in real scenario track individual trades)
      const avgProfit = newTrades > 0 ? newProfit / newTrades : 0;
      const bestTrade = Math.max(avgProfit * 1.5, 0); // Estimate best trade
      const worstTrade = Math.min(avgProfit * 0.5, 0); // Estimate worst trade

      const sessionStats = {
        sessionProfit: newProfit, // Only send the NEW profit
        sessionTrades: newTrades, // Only send the NEW trades
        sessionGasFees: newGasFees, // Only send the NEW gas fees
        sessionSlippage: newSlippage, // Only send the NEW slippage
        bestTrade,
        worstTrade
      };


      const response = await apiService.updateArbitrageStats(this.walletAddress, sessionStats);

      if (response.success) {
        this.addLog('INFO', 'Stats Saved',
          `New Profit: $${newProfit.toFixed(4)} saved to total arbitrage`
        );

        // Update what we've saved so far (but keep session stats for UI display)
        this.lastSavedProfit = this.state.totalProfit;
        this.lastSavedTrades = this.state.tradesExecuted;
        this.lastSavedGasFees = this.state.totalGasFees;
        this.lastSavedSlippage = this.state.totalSlippage;

        // Notify listeners that stats were updated
        if (this.onStatsUpdateCallback) {
          this.onStatsUpdateCallback();
        }
      } else {
        this.addLog('ERROR', 'Stats Save Failed', response.error || 'Unknown error');
      }
    } catch (error) {
      this.addLog('ERROR', 'Stats Save Error', error instanceof Error ? error.message : 'Unknown');
    }
  }

  getRunningDuration(): string {
    if (!this.state.startTime) return '0m';

    const now = new Date();
    const diff = now.getTime() - this.state.startTime.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
}

export const arbiGentService = new ArbiGentService();
export default ArbiGentService;
