// ArbiGent - Autonomous Arbitrage Agent Service
// Enhanced with Fallback Logic: If no profitable trade at current allocation,
// increases to 50% and scans all pairs (AUTO) to find best opportunity
import { apiService, ArbitrageOpportunity } from './ApiService';

export type LogType = 'INFO' | 'SCAN' | 'EXECUTE' | 'WARNING' | 'ERROR' | 'SUCCESS';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AgentLog {
  time: string;
  type: LogType;
  message: string;
  detail?: string;
}

export interface AgentConfig {
  minProfitThreshold: number;  // 0.00001% - 5.0%
  riskTolerance: RiskLevel;
  selectedPair: string;        // "AUTO" | "USDC_APT" | "APT_USDT" | "USDC_USDT"
  maxTradeCap: number;         // USD
  stopLoss: number;            // Percentage (negative)
  allocationPercent: number;   // Starting allocation (10%)
  scalingFactor: number;       // Increase on success (1.05 = 5%)
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
}

// All possible trading pairs for AUTO discovery
const ALL_TRADING_PAIRS = [
  { from: 'APT', to: 'USDC' },
  { from: 'APT', to: 'USDT' },
  { from: 'USDC', to: 'APT' },
  { from: 'USDC', to: 'USDT' },
  { from: 'USDT', to: 'APT' },
  { from: 'USDT', to: 'USDC' },
];

// Risk level constraints
const RISK_CONSTRAINTS: Record<RiskLevel, { maxTrade: number; gasLimit: number; stopLoss: number }> = {
  LOW: { maxTrade: 2500, gasLimit: 0.003, stopLoss: -1 },
  MEDIUM: { maxTrade: 5000, gasLimit: 0.005, stopLoss: -2 },
  HIGH: { maxTrade: 10000, gasLimit: 0.01, stopLoss: -5 },
};

// Risk acceptance mapping
const RISK_ACCEPTANCE: Record<RiskLevel, RiskLevel[]> = {
  LOW: ['LOW'],
  MEDIUM: ['LOW', 'MEDIUM'],
  HIGH: ['LOW', 'MEDIUM', 'HIGH'],
};

class ArbiGentService {
  private isRunning = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private logs: AgentLog[] = [];
  private onLogCallback: ((log: AgentLog) => void) | null = null;
  private onStateChangeCallback: ((state: AgentState) => void) | null = null;
  
  private state: AgentState = {
    isRunning: false,
    currentAllocation: 0.10,
    totalProfit: 0,
    tradesExecuted: 0,
    tradesSkipped: 0,
    startTime: null,
    lastTradeTime: null,
  };

  private config: AgentConfig = {
    minProfitThreshold: 0.00001,
    riskTolerance: 'MEDIUM',
    selectedPair: 'AUTO',
    maxTradeCap: 5000,
    stopLoss: -2,
    allocationPercent: 0.10,
    scalingFactor: 1.05,
  };

  private vaultBalances: VaultState = { APT: 0, USDC: 0, USDT: 0 };
  private livePrices: Record<string, number> = { APT: 0, USDC: 1, USDT: 1 };

  // Set callbacks for real-time updates
  onLog(callback: (log: AgentLog) => void) {
    this.onLogCallback = callback;
  }

  onStateChange(callback: (state: AgentState) => void) {
    this.onStateChangeCallback = callback;
  }

  // Update configuration
  updateConfig(newConfig: Partial<AgentConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    // Update max trade cap based on risk level
    const riskConstraints = RISK_CONSTRAINTS[this.config.riskTolerance];
    this.config.maxTradeCap = riskConstraints.maxTrade;
    this.config.stopLoss = riskConstraints.stopLoss;
  }

  // Update vault balances
  updateVaultBalances(balances: VaultState) {
    this.vaultBalances = balances;
  }

  // Update live prices
  updatePrices(prices: Record<string, number>) {
    this.livePrices = prices;
  }

  // Get current state
  getState(): AgentState {
    return { ...this.state };
  }

  // Get all logs
  getLogs(): AgentLog[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }

  // Add a log entry
  private addLog(type: LogType, message: string, detail?: string) {
    const log: AgentLog = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
      message,
      detail,
    };
    
    this.logs.push(log);
    
    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    if (this.onLogCallback) {
      this.onLogCallback(log);
    }
  }

  // Update state and notify
  private updateState(updates: Partial<AgentState>) {
    this.state = { ...this.state, ...updates };
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state);
    }
  }

  // Start the agent
  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.updateState({
      isRunning: true,
      startTime: new Date(),
      currentAllocation: this.config.allocationPercent,
    });
    
    this.addLog('INFO', 'ArbiGent started', `Config: ${this.config.riskTolerance} risk, ${this.config.minProfitThreshold}% min profit`);
    this.addLog('INFO', 'Initializing market scanners...', 'Connecting to DEX aggregators');
    this.addLog('INFO', 'Fallback mode enabled', 'Will increase to 50% allocation if no profitable trades found');
    
    // Start the main loop
    this.runLoop();
  }

  // Stop the agent
  stop() {
    this.isRunning = false;
    
    if (this.loopInterval) {
      clearTimeout(this.loopInterval);
      this.loopInterval = null;
    }
    
    this.updateState({ isRunning: false });
    this.addLog('INFO', 'ArbiGent stopped', `Total profit: $${this.state.totalProfit.toFixed(2)} | Trades: ${this.state.tradesExecuted}`);
  }

  // Main trading loop
  private async runLoop() {
    if (!this.isRunning) return;

    try {
      await this.executeCycle();
    } catch (error) {
      this.addLog('ERROR', 'Cycle error', error instanceof Error ? error.message : 'Unknown error');
    }

    // Random delay between 3-6 seconds
    const delay = 3000 + Math.random() * 3000;
    this.loopInterval = setTimeout(() => this.runLoop(), delay);
  }

  // Execute one trading cycle with fallback logic
  private async executeCycle() {
    // Step 1: Log price check
    this.addLog('INFO', 'Live Price Check', 
      `APT $${this.livePrices.APT?.toFixed(4) || '0'} | USDC $${this.livePrices.USDC?.toFixed(4) || '1'} | USDT $${this.livePrices.USDT?.toFixed(4) || '1'}`
    );

    // Step 2: Calculate initial trade amount based on current allocation
    const initialTradeAmount = this.calculateTradeAmount(this.state.currentAllocation);
    
    if (initialTradeAmount < 0.01) {
      this.addLog('WARNING', 'Insufficient funds', 'Trade amount below minimum threshold ($0.01)');
      return;
    }

    // Step 3: First attempt - scan with current allocation
    this.addLog('SCAN', 'Phase 1: Scanning with current allocation...', 
      `Amount: $${initialTradeAmount.toFixed(2)} (${(this.state.currentAllocation * 100).toFixed(0)}%)`
    );

    let opportunity = await this.findProfitableOpportunity(initialTradeAmount);
    let usedFallback = false;

    // Step 4: FALLBACK LOGIC - If no profitable opportunity, increase to 50% and scan all pairs
    if (!opportunity || !this.isOpportunityProfitable(opportunity)) {
      this.addLog('WARNING', 'No profitable opportunity at current allocation', 
        'Activating fallback: Increasing to 50% and scanning all pairs...'
      );

      // Calculate 50% of vault balance
      const fallbackTradeAmount = this.calculateTradeAmount(0.50);
      
      if (fallbackTradeAmount < 0.01) {
        this.addLog('WARNING', 'Fallback failed', 'Even 50% allocation is below minimum threshold');
        return;
      }

      this.addLog('SCAN', 'Phase 2: Fallback scan with 50% allocation...', 
        `Amount: $${fallbackTradeAmount.toFixed(2)}`
      );

      // Scan ALL pairs to find the best opportunity
      opportunity = await this.scanAllPairsForBestOpportunity(fallbackTradeAmount);
      usedFallback = true;

      if (!opportunity) {
        this.addLog('INFO', 'No opportunities found', 'All pairs scanned, no profitable routes available');
        return;
      }
    }

    // Step 5: Evaluate opportunity against constraints
    const decision = this.evaluateOpportunity(opportunity);

    if (decision.execute) {
      await this.executeSimulatedTrade(opportunity, usedFallback);
    } else {
      this.handleSkippedTrade(opportunity, decision.reason);
    }
  }

  // Check if opportunity meets minimum profitability
  private isOpportunityProfitable(opp: ArbitrageOpportunity | null): boolean {
    if (!opp) return false;
    return opp.profitability.is_profitable && 
           opp.profitability.profit_margin_percent >= this.config.minProfitThreshold;
  }

  // Calculate trade amount for a specific allocation percentage
  private calculateTradeAmount(allocationPercent: number): number {
    const { selectedPair, maxTradeCap } = this.config;
    
    let sourceToken: keyof VaultState;
    
    if (selectedPair === 'AUTO') {
      // Pick token with highest USD value
      const aptValue = this.vaultBalances.APT * (this.livePrices.APT || 0);
      const usdcValue = this.vaultBalances.USDC * (this.livePrices.USDC || 1);
      const usdtValue = this.vaultBalances.USDT * (this.livePrices.USDT || 1);
      
      if (aptValue >= usdcValue && aptValue >= usdtValue) {
        sourceToken = 'APT';
      } else if (usdcValue >= usdtValue) {
        sourceToken = 'USDC';
      } else {
        sourceToken = 'USDT';
      }
    } else {
      // Parse from pair (e.g., "USDC_APT" -> "USDC")
      sourceToken = selectedPair.split('_')[0] as keyof VaultState;
    }
    
    const balance = this.vaultBalances[sourceToken] || 0;
    const price = this.livePrices[sourceToken] || 1;
    const balanceUsd = balance * price;
    
    let tradeAmount = balanceUsd * allocationPercent;
    
    // Cap at max trade
    return Math.min(tradeAmount, maxTradeCap);
  }

  // Calculate trade amount for a specific token at given allocation
  private calculateTokenTradeAmount(token: keyof VaultState, allocationPercent: number): number {
    const balance = this.vaultBalances[token] || 0;
    const price = this.livePrices[token] || 1;
    const balanceUsd = balance * price;
    return Math.min(balanceUsd * allocationPercent, this.config.maxTradeCap);
  }

  // Find profitable opportunity based on current config
  private async findProfitableOpportunity(tradeAmount: number): Promise<ArbitrageOpportunity | null> {
    if (this.config.selectedPair === 'AUTO') {
      return await this.findBestOpportunityFromPossibilities(tradeAmount);
    } else {
      return await this.checkSpecificPair(tradeAmount);
    }
  }

  // Use /arbitrage/possibilities endpoint to find best opportunity
  private async findBestOpportunityFromPossibilities(tradeAmount: number): Promise<ArbitrageOpportunity | null> {
    try {
      const response = await apiService.findArbitrageOpportunities({
        trade_amount: tradeAmount,
        dex_fees: { 'Smart Contract': 0.30 },
      });

      if (response.success && response.data?.opportunities?.top_opportunities?.length > 0) {
        const opportunities = response.data.opportunities.top_opportunities;
        
        // Filter for profitable opportunities that meet threshold
        const profitableOpps = opportunities.filter(opp => 
          opp.profitability.is_profitable && 
          opp.profitability.profit_margin_percent >= this.config.minProfitThreshold
        );

        if (profitableOpps.length > 0) {
          // Return the best opportunity (highest profit margin)
          return profitableOpps.reduce((best, current) => 
            current.profitability.profit_margin_percent > best.profitability.profit_margin_percent 
              ? current : best
          );
        }
      }
    } catch (error) {
      this.addLog('ERROR', 'API Error', 'Failed to fetch opportunities from /possibilities');
    }
    
    return null;
  }

  // Scan ALL pairs individually to find the absolute best opportunity (Fallback mode)
  private async scanAllPairsForBestOpportunity(tradeAmount: number): Promise<ArbitrageOpportunity | null> {
    const allOpportunities: ArbitrageOpportunity[] = [];
    
    // First, try the /possibilities endpoint with 50% allocation
    this.addLog('SCAN', 'Querying /arbitrage/possibilities...', `Trade amount: $${tradeAmount.toFixed(2)}`);
    
    try {
      const possibilitiesResponse = await apiService.findArbitrageOpportunities({
        trade_amount: tradeAmount,
        dex_fees: { 'Smart Contract': 0.30 },
      });

      if (possibilitiesResponse.success && possibilitiesResponse.data?.opportunities?.top_opportunities) {
        const opps = possibilitiesResponse.data.opportunities.top_opportunities;
        this.addLog('INFO', `Found ${opps.length} opportunities from /possibilities`, 
          `Best margin: ${opps[0]?.profitability?.profit_margin_percent?.toFixed(4) || 0}%`
        );
        allOpportunities.push(...opps);
      }
    } catch (error) {
      this.addLog('WARNING', 'Possibilities endpoint failed', 'Falling back to individual pair checks');
    }

    // Then, check each pair individually using /isprofitable for more granular control
    this.addLog('SCAN', 'Checking individual pairs via /arbitrage/isprofitable...', 
      `Scanning ${ALL_TRADING_PAIRS.length} pairs`
    );

    for (const pair of ALL_TRADING_PAIRS) {
      // Calculate trade amount based on the source token's balance
      const sourceBalance = this.calculateTokenTradeAmount(pair.from as keyof VaultState, 0.50);
      
      if (sourceBalance < 0.01) continue; // Skip if insufficient balance
      
      try {
        const response = await apiService.checkProfitability({
          from_token: pair.from.toLowerCase(),
          to_token: pair.to.toLowerCase(),
          trade_amount: sourceBalance,
          dex_fees: { 'Smart Contract': 0.30 },
        });

        if (response.success && response.data) {
          const opp = response.data;
          if (opp.profitability.is_profitable) {
            this.addLog('INFO', `${pair.from} → ${pair.to}: ${opp.profitability.profit_margin_percent.toFixed(4)}%`, 
              `Profit: $${opp.profitability.net_profit_usd.toFixed(4)}`
            );
            allOpportunities.push(opp);
          }
        }
      } catch (error) {
        // Silent fail for individual pairs
      }
    }

    if (allOpportunities.length === 0) {
      return null;
    }

    // Find the best opportunity across all scanned pairs
    const bestOpportunity = allOpportunities.reduce((best, current) => {
      // Prioritize by: 1) is_profitable, 2) profit_margin_percent
      if (!best.profitability.is_profitable && current.profitability.is_profitable) {
        return current;
      }
      if (current.profitability.is_profitable && 
          current.profitability.profit_margin_percent > best.profitability.profit_margin_percent) {
        return current;
      }
      return best;
    });

    this.addLog('SUCCESS', 'Best opportunity found', 
      `${bestOpportunity.route.from_pair} → ${bestOpportunity.route.to_pair} | Margin: ${bestOpportunity.profitability.profit_margin_percent.toFixed(4)}%`
    );

    return bestOpportunity;
  }

  // Check specific trading pair using /isprofitable
  private async checkSpecificPair(tradeAmount: number): Promise<ArbitrageOpportunity | null> {
    const [fromToken, toToken] = this.config.selectedPair.toLowerCase().split('_');
    
    try {
      const response = await apiService.checkProfitability({
        from_token: fromToken,
        to_token: toToken,
        trade_amount: tradeAmount,
        dex_fees: { 'Smart Contract': 0.30 },
      });

      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      this.addLog('ERROR', 'API Error', `Failed to check ${fromToken} → ${toToken}`);
    }
    
    return null;
  }

  // Evaluate opportunity against user constraints
  private evaluateOpportunity(opp: ArbitrageOpportunity): { execute: boolean; reason: string } {
    const { minProfitThreshold, riskTolerance } = this.config;
    const { profitability, risk_level } = opp;

    // Check profitability
    if (!profitability.is_profitable) {
      return { execute: false, reason: 'Not profitable' };
    }

    // Check profit threshold
    if (profitability.profit_margin_percent < minProfitThreshold) {
      return { 
        execute: false, 
        reason: `Margin ${profitability.profit_margin_percent.toFixed(5)}% < Threshold ${minProfitThreshold}%` 
      };
    }

    // Check risk level
    const acceptableRisks = RISK_ACCEPTANCE[riskTolerance];
    if (!acceptableRisks.includes(risk_level as RiskLevel)) {
      return { 
        execute: false, 
        reason: `Risk ${risk_level} exceeds tolerance ${riskTolerance}` 
      };
    }

    return { execute: true, reason: 'All criteria met' };
  }

  // Execute simulated trade (update state, don't actually trade)
  private async executeSimulatedTrade(opp: ArbitrageOpportunity, usedFallback: boolean) {
    const { route, profitability, charges } = opp;
    
    if (usedFallback) {
      this.addLog('INFO', '🔄 Fallback trade activated', 'Using 50% allocation after initial scan failed');
    }
    
    this.addLog('SUCCESS', '⚡ EXECUTING SWAP', 
      `Route: ${route.from_pair} → ${route.to_pair}`
    );
    
    this.addLog('INFO', 'Trade Details', 
      `Amount: $${route.trade_amount.toFixed(2)} | Gas: ${charges.gas_fees.total_gas_cost_apt.toFixed(4)} APT`
    );
    
    this.addLog('SUCCESS', 'Trade Completed', 
      `Net Profit: +$${profitability.net_profit_usd.toFixed(4)} (${profitability.profit_margin_percent.toFixed(4)}%)`
    );

    // Update state
    const newProfit = this.state.totalProfit + profitability.net_profit_usd;
    
    // If we used fallback, reset to base allocation; otherwise scale up
    let newAllocation: number;
    if (usedFallback) {
      // After fallback success, start fresh with base allocation
      newAllocation = this.config.allocationPercent;
      this.addLog('INFO', 'Strategy Reset', 
        `Resetting allocation to ${(newAllocation * 100).toFixed(0)}% after fallback trade`
      );
    } else {
      // Normal scaling on success
      newAllocation = Math.min(this.state.currentAllocation * this.config.scalingFactor, 0.50);
      this.addLog('INFO', 'Strategy Update', 
        `Increasing allocation to ${(newAllocation * 100).toFixed(0)}% for next trade`
      );
    }
    
    this.updateState({
      totalProfit: newProfit,
      tradesExecuted: this.state.tradesExecuted + 1,
      lastTradeTime: new Date(),
      currentAllocation: newAllocation,
    });
  }

  // Handle skipped trade
  private handleSkippedTrade(opp: ArbitrageOpportunity, reason: string) {
    const { route, profitability, risk_level } = opp;
    
    this.addLog('WARNING', `Opportunity detected: ${route.from_pair} → ${route.to_pair}`, 
      `Margin: ${profitability.profit_margin_percent.toFixed(5)}% | Risk: ${risk_level}`
    );
    
    this.addLog('WARNING', 'Decision: SKIP', reason);

    // Reset allocation on skip
    this.updateState({
      tradesSkipped: this.state.tradesSkipped + 1,
      currentAllocation: this.config.allocationPercent,
    });
  }

  // Get running duration as formatted string
  getRunningDuration(): string {
    if (!this.state.startTime) return '0m';
    
    const now = new Date();
    const diff = now.getTime() - this.state.startTime.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

// Export singleton instance
export const arbiGentService = new ArbiGentService();
export default ArbiGentService;
