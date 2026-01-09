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
  private currentAutoRouteIndex = 0;
  private walletAddress: string | null = null;
  
  // Track current allocation - starts at 10%, goes to 50% on success
  private currentAllocationPercent = 0.10;
  private consecutiveFailures = 0;
  
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
    this.currentAllocationPercent = 0.10; // Start at 10%
    this.consecutiveFailures = 0;
    
    this.updateState({
      isRunning: true,
      startTime: new Date(),
      currentAllocation: 0.10,
      totalGasFees: 0,
      totalSlippage: 0,
      totalCosts: 0,
      totalProfit: 0,
      tradesExecuted: 0,
      tradesSkipped: 0,
    });
    
    this.addLog('INFO', 'ArbiGent Started', 
      `Risk: ${this.config.riskTolerance} | Min Profit: ${this.config.minProfitThreshold}%`
    );
    this.addLog('INFO', 'Strategy', 
      `AUTO: Switch chains | Specific: Stay on route | Start 10% → 50% if profitable`
    );
    
    this.runLoop();
  }

  stop() {
    this.isRunning = false;
    
    if (this.loopInterval) {
      clearTimeout(this.loopInterval);
      this.loopInterval = null;
    }
    
    this.updateState({ isRunning: false });
    this.addLog('INFO', 'ArbiGent Stopped', 
      `Profit: $${this.state.totalProfit.toFixed(4)} | Trades: ${this.state.tradesExecuted} | Gas: $${this.state.totalGasFees.toFixed(4)}`
    );
  }

  private async runLoop() {
    if (!this.isRunning) return;

    try {
      await this.executeCycle();
    } catch (error) {
      this.addLog('ERROR', 'Cycle Error', error instanceof Error ? error.message : 'Unknown error');
    }

    // Continue if still running
    if (this.isRunning) {
      const delay = 3000 + Math.random() * 3000;
      this.loopInterval = setTimeout(() => this.runLoop(), delay);
    }
  }

  private async executeCycle() {
    // Log current prices
    this.addLog('INFO', 'Price Check', 
      `APT: $${this.livePrices.APT?.toFixed(4)} | USDC: $${this.livePrices.USDC?.toFixed(4)} | USDT: $${this.livePrices.USDT?.toFixed(4)}`
    );

    // Log vault status
    this.addLog('INFO', 'Vault Balance', 
      `APT: ${this.vaultBalances.APT.toFixed(4)} | USDC: ${this.vaultBalances.USDC.toFixed(4)} | USDT: ${this.vaultBalances.USDT.toFixed(4)}`
    );

    // Get the route to check
    let routeKey: string;
    if (this.config.selectedPair === 'AUTO') {
      routeKey = AUTO_ROUTES[this.currentAutoRouteIndex];
      this.currentAutoRouteIndex = (this.currentAutoRouteIndex + 1) % AUTO_ROUTES.length;
    } else {
      routeKey = this.config.selectedPair;
    }

    const route = ARBITRAGE_ROUTES[routeKey];
    if (!route) {
      this.addLog('ERROR', 'Invalid Route', `Route ${routeKey} not found`);
      return;
    }

    // Check if we have enough balance
    const fromBalanceUsd = this.getTokenBalanceUsd(route.fromToken);
    if (fromBalanceUsd < MIN_BALANCE_USD) {
      this.addLog('ERROR', 'Insufficient Balance', 
        `${route.fromToken} balance ($${fromBalanceUsd.toFixed(4)}) below minimum ($${MIN_BALANCE_USD})`
      );
      this.addLog('WARNING', 'Stopping Agent', 'Token balance too low to continue');
      this.stop();
      return;
    }

    this.addLog('SCAN', `Checking: ${route.name}`, 
      `Allocation: ${(this.currentAllocationPercent * 100).toFixed(0)}%`
    );

    // Calculate trade amount
    const tradeAmount = this.calculateTradeAmount(route.fromToken, this.currentAllocationPercent);
    
    if (tradeAmount < 0.01) {
      this.addLog('WARNING', 'Trade Amount Too Low', `$${tradeAmount.toFixed(4)} < $0.01`);
      this.handleUnprofitable(route);
      return;
    }

    this.addLog('INFO', 'Trade Amount', `$${tradeAmount.toFixed(4)} (${(this.currentAllocationPercent * 100).toFixed(0)}% of ${route.fromToken})`);

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

    this.addLog('INFO', 'Analysis', 
      `Profitable: ${opportunity.profitability.is_profitable} | Margin: ${opportunity.profitability.profit_margin_percent.toFixed(4)}%`
    );
    this.addLog('INFO', 'Costs', 
      `Gas: $${gasCost.toFixed(4)} | Slippage: ${slippage.toFixed(4)}% | Total: $${totalCost.toFixed(4)}`
    );

    // Check if profitable
    if (opportunity.profitability.is_profitable && 
        opportunity.profitability.profit_margin_percent >= this.config.minProfitThreshold) {
      
      // Execute the trade
      await this.executeTrade(route, opportunity);
      
      // Reset failure counter
      this.consecutiveFailures = 0;
      
      // If we were at 10%, switch to 50% for next trade
      if (this.currentAllocationPercent === 0.10) {
        this.currentAllocationPercent = 0.50;
        this.addLog('SUCCESS', 'Allocation Increased', 'Switching to 50% for continued trading');
        this.updateState({ currentAllocation: 0.50 });
      }
      
    } else {
      // Not profitable at current allocation
      this.handleUnprofitable(route);
    }
  }

  private handleUnprofitable(route: ArbitrageRoute) {
    this.consecutiveFailures++;
    
    if (this.currentAllocationPercent === 0.10) {
      // Try 50%
      this.addLog('WARNING', 'Not Profitable at 10%', 'Trying 50% allocation...');
      this.currentAllocationPercent = 0.50;
      this.updateState({ currentAllocation: 0.50 });
      
    } else if (this.currentAllocationPercent === 0.50) {
      // Try 80%
      this.addLog('WARNING', 'Not Profitable at 50%', 'Trying 80% allocation...');
      this.currentAllocationPercent = 0.80;
      this.updateState({ currentAllocation: 0.80 });
      
    } else if (this.currentAllocationPercent === 0.80) {
      // Try 100%
      this.addLog('WARNING', 'Not Profitable at 80%', 'Trying 100% allocation...');
      this.currentAllocationPercent = 1.00;
      this.updateState({ currentAllocation: 1.00 });
      
    } else {
      // Already at 100%, still not profitable
      this.addLog('ERROR', 'Not Profitable at 100%', 'No profitable opportunity found');
      this.updateState({ tradesSkipped: this.state.tradesSkipped + 1 });
      
      // Reset to 10% for next route
      this.currentAllocationPercent = 0.10;
      this.updateState({ currentAllocation: 0.10 });
      
      // If too many consecutive failures, consider stopping
      if (this.consecutiveFailures >= 12) { // 3 full cycles of all routes
        this.addLog('ERROR', 'Too Many Failures', 'Stopping agent after 12 consecutive unprofitable checks');
        this.stop();
      }
    }
  }

  private getTokenBalanceUsd(token: keyof VaultState): number {
    const balance = this.vaultBalances[token] || 0;
    const price = this.livePrices[token] || 1;
    return balance * price;
  }

  private calculateTradeAmount(token: keyof VaultState, allocation: number): number {
    const balanceUsd = this.getTokenBalanceUsd(token);
    return Math.min(balanceUsd * allocation, this.config.maxTradeCap);
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
    const profitUsd = profitability.net_profit_usd;

    // Get prices
    const fromPrice = this.livePrices[route.fromToken] || 1;
    const midPrice = this.livePrices[route.midToken] || 1;
    const toPrice = this.livePrices[route.toToken] || 1;

    // Calculate token flow: from_token → mid_token → to_token
    // Step 1: from_token → mid_token
    const fromTokenAmount = tradeAmountUsd / fromPrice;
    const midTokenAmount = (fromTokenAmount * fromPrice) / midPrice;
    
    // Step 2: mid_token → to_token (includes profit)
    const finalValueUsd = tradeAmountUsd + profitUsd;
    const toTokenAmount = finalValueUsd / toPrice;

    this.addLog('SUCCESS', '⚡ EXECUTING ARBITRAGE', route.name);

    this.addLog('INFO', 'Token Flow', 
      `${route.fromToken}: -${fromTokenAmount.toFixed(6)} → ${route.midToken}: ${midTokenAmount.toFixed(6)} → ${route.toToken}: +${toTokenAmount.toFixed(6)}`
    );

    this.addLog('INFO', 'Cost Breakdown', 
      `Gas: $${gasCostUsd.toFixed(4)} | Slippage: $${slippageCostUsd.toFixed(4)} | Total: $${totalCostUsd.toFixed(4)}`
    );

    // Update local vault balances
    const oldFromBalance = this.vaultBalances[route.fromToken];
    const oldToBalance = this.vaultBalances[route.toToken];
    
    // Deduct from_token
    this.vaultBalances[route.fromToken] = Math.max(0, oldFromBalance - fromTokenAmount);
    
    // Add to_token
    this.vaultBalances[route.toToken] = oldToBalance + toTokenAmount;

    this.addLog('SUCCESS', 'Vault Updated', 
      `${route.fromToken}: ${oldFromBalance.toFixed(6)} → ${this.vaultBalances[route.fromToken].toFixed(6)} | ${route.toToken}: ${oldToBalance.toFixed(6)} → ${this.vaultBalances[route.toToken].toFixed(6)}`
    );

    // Update vault - deduct from_token and add to_token
    await this.updateVault(route, fromTokenAmount, toTokenAmount);

    this.addLog('SUCCESS', 'Trade Complete', 
      `Invested: $${tradeAmountUsd.toFixed(4)} | Received: $${finalValueUsd.toFixed(4)} | Profit: +$${profitUsd.toFixed(4)} (${profitability.profit_margin_percent.toFixed(4)}%)`
    );

    // Update state
    this.updateState({
      totalProfit: this.state.totalProfit + profitUsd,
      tradesExecuted: this.state.tradesExecuted + 1,
      lastTradeTime: new Date(),
      totalGasFees: this.state.totalGasFees + gasCostUsd,
      totalSlippage: this.state.totalSlippage + slippageCostUsd,
      totalCosts: this.state.totalCosts + totalCostUsd,
    });

    this.notifyVaultUpdate();

    this.addLog('INFO', 'Session Stats', 
      `Total Profit: $${this.state.totalProfit.toFixed(4)} | Trades: ${this.state.tradesExecuted}`
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
        this.addLog('INFO', 'Vault: Deducted', 
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
        this.addLog('INFO', 'Vault: Added', 
          `${route.toToken}: +${toAmount.toFixed(6)}`
        );
      }

      this.addLog('SUCCESS', 'Vault Synced', 'Balances updated in database');

    } catch (error) {
      this.addLog('ERROR', 'Vault Update Failed', error instanceof Error ? error.message : 'Unknown');
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
