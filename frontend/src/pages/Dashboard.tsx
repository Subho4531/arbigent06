import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Wallet, TrendingUp, Bot, ArrowRight,
  Shield, Vault, Activity, ExternalLink, RefreshCw
} from "lucide-react";
import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import CryptoLogo from "@/components/CryptoLogo";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import UpdateNotification from "@/components/UpdateNotification";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/hooks/useVault";
import { useMarketData } from "@/hooks/useMarketData";
import { apiService } from "@/services/ApiService";
import useArbiGent from "@/hooks/useArbiGent";

// Low-brightness animated background component (matches Vault.tsx style)
const AnimatedBackground = () => (
  <div className="fixed inset-0 pointer-events-none">
    <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/[0.07] rounded-full blur-3xl animate-pulse" />
    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/[0.07] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary/[0.03] to-orange-500/[0.03] rounded-full blur-3xl" />
  </div>
);

const Dashboard = () => {
  const { connected, account } = useWallet();
  const { vault, isLoading: vaultLoading } = useVault();
  const { tokenPrices, opportunities, isLoading: marketLoading, refreshOpportunities } = useMarketData();

  // ArbiGent hook for agent status
  const {
    isRunning,
    logs,
    agentState,
    agentConfig,
    runningDuration,
    startAgent,
    stopAgent,
    clearLogs,
    updateConfig,
    updateVaultBalances: updateAgentVaultBalances,
    updatePrices,
    setWalletAddress,
    onStatsUpdate,
  } = useArbiGent();

  // State for arbitrage stats
  const [arbitrageStats, setArbitrageStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastStatsUpdate, setLastStatsUpdate] = useState<Date | null>(null);
  const [previousStats, setPreviousStats] = useState<any>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'info' | 'profit' | 'loss'>('info');

  // Use ref to avoid dependency issues
  const arbitrageStatsRef = useRef<any>(null);

  // Fetch arbitrage stats
  const fetchArbitrageStats = useCallback(async (isBackground = false) => {
    if (!connected || !account?.address) {
      console.log('Not fetching stats - not connected or no address');
      setArbitrageStats(null);
      setIsInitialLoad(false);
      return;
    }


    // Only show loading spinner for manual refreshes, not background updates
    if (!isBackground) {
      setIsLoadingStats(true);
    }

    try {
      const response = await apiService.getArbitrageStats(account.address);

      if (response.success) {

        // Store previous stats for smooth transitions
        const currentStats = arbitrageStatsRef.current;
        if (currentStats) {
          setPreviousStats(currentStats);

          // Show notification for significant changes
          const profitChange = response.data.arbitrageStats.totalProfitLoss - currentStats.totalProfitLoss;
          if (Math.abs(profitChange) > 0.01) {
            setNotificationMessage(`Arbitrage updated: ${profitChange >= 0 ? '+' : ''}$${profitChange.toFixed(2)}`);
            setNotificationType(profitChange >= 0 ? 'profit' : 'loss');
            setShowUpdateNotification(true);
          }
        }

        setArbitrageStats(response.data.arbitrageStats);
        arbitrageStatsRef.current = response.data.arbitrageStats;
        setLastStatsUpdate(new Date());
        setIsInitialLoad(false);
      } else {
        console.warn('❌ Failed to fetch arbitrage stats:', response.error);
        if (isInitialLoad) {
          setArbitrageStats(null);
        }
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('💥 Error fetching arbitrage stats:', error);
      if (isInitialLoad) {
        setArbitrageStats(null);
      }
      setIsInitialLoad(false);
    } finally {
      if (!isBackground) {
        setIsLoadingStats(false);
      }
    }
  }, [connected, account?.address]);

  // Fetch arbitrage stats on mount and when wallet changes
  useEffect(() => {
    fetchArbitrageStats();
  }, [fetchArbitrageStats]);

  // Set wallet address when account changes
  useEffect(() => {
    if (account?.address) {
      setWalletAddress(account.address);
    }
  }, [account?.address, setWalletAddress]);

  // Set up stats update callback - only for agent-triggered updates
  useEffect(() => {
    onStatsUpdate(() => {
      console.log('Stats update callback triggered from agent');
      setTimeout(() => {
        fetchArbitrageStats(true); // Background refresh when agent updates stats
      }, 500); // Small delay to ensure backend has processed
    });
  }, [onStatsUpdate, fetchArbitrageStats]);

  // Calculate total vault value in USD
  const calculateTotalVaultValue = () => {
    if (!vault || !tokenPrices) return { total: 0, aptBalance: 0 };

    let total = 0;
    let aptBalance = 0;

    vault.balances.forEach(balance => {
      const symbol = balance.coinSymbol.toUpperCase();
      const price = tokenPrices[symbol];
      if (price) {
        const decimals = symbol === 'APT' ? 8 : 6;
        const balanceNum = (parseFloat(balance.balance) || 0) / Math.pow(10, decimals);
        const priceStr = price.price.replace('$', '').replace(',', '');
        const priceNum = parseFloat(priceStr) || 0;
        const value = balanceNum * priceNum;
        total += value;

        if (symbol === 'APT') {
          aptBalance = balanceNum;
        }
      }
    });

    return { total, aptBalance };
  };

  const vaultStats = calculateTotalVaultValue();
  const aptPrice = tokenPrices.APT?.price || '$0.00';
  const aptChange = tokenPrices.APT?.change || '+0.0%';

  // Transform opportunities for display
  const displayOpportunities = (opportunities || []).slice(0, 5).map(opp => {
    const fromToken = opp.route.from_pair?.split('_')[0]?.toUpperCase() || 'UNKNOWN';
    const toToken = opp.route.to_pair?.split('_')[1]?.toUpperCase() || 'APT';

    return {
      pair: `${fromToken}/${toToken}`,
      route: `${opp.route.from_dex} → ${opp.route.to_dex}`,
      spread: `${(opp.profitability.price_difference_percent || 0).toFixed(2)}%`,
      profit: `$${opp.profitability.net_profit_usd.toFixed(2)}`,
      gas: `${(opp.charges?.gas_fees?.total_gas_cost_apt || 0).toFixed(3)} APT`,
      risk: opp.risk_level.toUpperCase(),
      isExecutable: opp.profitability.is_profitable && opp.profitability.net_profit_usd > 1
    };
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "LOW": return "bg-success/20 text-success border-success/30";
      case "MEDIUM": case "MED": return "bg-warning/20 text-warning border-warning/30";
      case "HIGH": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background dark relative overflow-hidden">
        <AnimatedBackground />
        <Header />
        <main className="pt-24 pb-16 relative z-10">
          <div className="container mx-auto px-4 lg:px-8 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl lg:text-5xl font-bold tracking-wide text-foreground mb-4"
            >
              DASHBOARD
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground mb-8"
            >
              Please connect your wallet to access the dashboard.
            </motion.p>
          </div>
        </main>
      </div>
    );
  }

  // Show skeleton loader during initial load
  if (isInitialLoad && connected) {
    return <DashboardSkeleton />;
  }


  return (
    <div className="min-h-screen bg-background dark relative overflow-hidden">
      <AnimatedBackground />
      <Header />

      {/* Update Notification */}
      <UpdateNotification
        show={showUpdateNotification}
        message={notificationMessage}
        type={notificationType}
        onHide={() => setShowUpdateNotification(false)}
      />

      <main className="pt-24 pb-16 relative z-10">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-wide text-foreground mb-2">
                DASHBOARD
              </h1>
              <p className="text-muted-foreground">
                Manage your autonomous trading agents.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchArbitrageStats(false)}
              disabled={isLoadingStats}
              className="text-primary mr-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>

          </motion.div>



          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard
              icon={Wallet}
              label="Total Vault Balance"
              value={`$${vaultStats.total.toFixed(2)}`}
              // subValue={`APT: ${vaultStats.aptBalance.toFixed(4)}`}
              delay={0}
              isLoading={vaultLoading}
            />
            {(() => {
              const plValue = isInitialLoad ? 0 : (arbitrageStats?.totalProfitLoss || 0);

              // Temporary simple display for debugging
              if (!isInitialLoad && arbitrageStats?.totalProfitLoss !== undefined) {
              }

              return (
                <StatsCard
                  icon={TrendingUp}
                  label="Total Arbitrage"
                  value={plValue}
                  subValue={`${arbitrageStats?.totalTrades || 0} trades • ${arbitrageStats?.totalSessions || 0} sessions`}
                  trend={{
                    value: arbitrageStats?.totalProfitLoss > 0 ? `+${((arbitrageStats.totalProfitLoss / Math.max(vaultStats.total, 100)) * 100).toFixed(1)}%` : "0.0%",
                    isPositive: (arbitrageStats?.totalProfitLoss || 0) >= 0
                  }}
                  delay={0.1}
                  isLoading={isInitialLoad}
                  isAnimated={true}
                  previousValue={previousStats?.totalProfitLoss}
                  showChangeIndicator={true}
                  isUpdating={isLoadingStats && !isInitialLoad}
                />
              );
            })()}
            <StatsCard
              icon={Bot}
              label="Active Agents"
              value={isRunning ? "1" : "0"}
              subValue={isRunning ? `ArbiGent running • ${runningDuration}` : "No agents running"}
              delay={0.2}
            />
            <StatsCard
              icon={Activity}
              label="APT Price"
              value={aptPrice}
              subValue={`24h: ${aptChange}`}
              delay={0.3}
              isLoading={marketLoading}
            />
          </div>

          {/* Quick Actions */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <div className="rounded-xl border border-border bg-card p-6">


            
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Shield className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold tracking-wide text-foreground mb-2">NO ACTIVE AGENTS</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Deploy your first autonomous trading agent to start capturing arbitrage opportunities across Aptos DEXs.
                </p>
                <Button variant="glow" size="lg" asChild>
                  <Link to="/agents">
                    Launch Your First Agent
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div> */}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  ACTIVE AGENTS
                </h2>
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/20 border border-success/30">
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="text-xs font-mono text-success">RUNNING</span>
                    </div>
                  )}
                  {/* <span className="text-sm text-muted-foreground">
                    {isRunning ? '1 Active' : '0 Active'}
                  </span> */}
                  {isRunning ?null: (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 text-white">
    <div className="flex gap-3">
      <Button variant="outline" size="default" asChild>
        <Link to="/vault">
          <Vault className="h-4 w-4" />
          Go to Vault
        </Link>
      </Button>
      <Button variant="default" size="default" asChild>
        <Link to="/agents">
          + Launch New Agent
        </Link>
      </Button>
    </div>
  </div>
) }
                </div>
              </div>

              {isRunning ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Agent Status Card */}
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                        <span className="font-display font-bold text-foreground">ArbiGent #1</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Running: {runningDuration}</span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span className="font-mono text-foreground">{agentConfig.selectedPair}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Risk Level:</span>
                        <span className="font-mono text-foreground">{agentConfig.riskTolerance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min Profit:</span>
                        <span className="font-mono text-foreground">{agentConfig.minProfitThreshold.toFixed(4)}%</span>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Session Arbitrage</p>
                          <p className="font-mono font-bold text-success">+${agentState.totalProfit.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Trades</p>
                          <p className="font-mono font-bold text-foreground">{agentState.tradesExecuted}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Success</p>
                          <p className="font-mono font-bold text-primary">
                            {agentState.tradesExecuted > 0
                              ? ((agentState.tradesExecuted / (agentState.tradesExecuted + agentState.tradesSkipped)) * 100).toFixed(0)
                              : 0}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <h3 className="font-display font-bold text-foreground mb-3">Recent Activity</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {logs.slice(-4).reverse().map((log, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">[{log.time}]</span>
                          <span className={`font-mono ${log.type === 'SUCCESS' ? 'text-success' :
                              log.type === 'ERROR' ? 'text-destructive' :
                                log.type === 'WARNING' ? 'text-warning' :
                                  log.type === 'SCAN' ? 'text-primary' :
                                    'text-muted-foreground'
                            }`}>
                            {log.type}
                          </span>
                          <span className="text-foreground truncate">{log.message}</span>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No activity yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mx-auto mb-4">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-2">No active agents</p>
                  <p className="text-xs text-muted-foreground">Start an agent to begin autonomous trading</p>
                </div>
              )}
            </div>
          </motion.div>


          {/* Opportunities Table */}
          
        </div>
      </main>
    </div>
  );
};

export default Dashboard;