import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Wallet, TrendingUp, Bot, Clock, ArrowRight, 
  Shield, Vault, Activity, ExternalLink, RefreshCw 
} from "lucide-react";
import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import CryptoLogo from "@/components/CryptoLogo";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/hooks/useVault";
import { useMarketData } from "@/hooks/useMarketData";

const Dashboard = () => {
  const { connected, account } = useWallet();
  const { vault, isLoading: vaultLoading } = useVault();
  const { tokenPrices, opportunities, isLoading: marketLoading, refreshOpportunities } = useMarketData();
  
  // Calculate total vault value in USD
  const calculateTotalVaultValue = () => {
    if (!vault || !tokenPrices) return { total: 0, aptBalance: 0, aptChange: 0 };
    
    let total = 0;
    let aptBalance = 0;
    
    vault.balances.forEach(balance => {
      const price = tokenPrices[balance.coinSymbol];
      if (price) {
        const balanceNum = parseFloat(balance.balance) || 0;
        const priceNum = parseFloat(price.price.replace('$', '')) || 0;
        const value = balanceNum * priceNum;
        total += value;
        
        if (balance.coinSymbol === 'APT') {
          aptBalance = balanceNum;
        }
      }
    });
    
    return { 
      total, 
      aptBalance, 
      aptChange: 0 // Would need historical data for real change calculation
    };
  };

  const vaultStats = calculateTotalVaultValue();
  const aptPrice = tokenPrices.APT?.price || '$0.00';
  const aptChange = tokenPrices.APT?.change || '0.0%';

  // Transform opportunities for display
  const displayOpportunities = opportunities.slice(0, 5).map(opp => {
    const fromToken = opp.route.from_pair.split('_')[0].toUpperCase();
    const toToken = opp.route.to_pair.split('_')[1].toUpperCase();
    
    return {
      pair: `${fromToken}/${toToken}`,
      route: `${opp.route.from_dex} → ${opp.route.to_dex}`,
      spread: `${opp.profitability.price_difference_percent.toFixed(2)}%`,
      profit: `$${opp.profitability.net_profit_usd.toFixed(2)}`,
      gas: `${opp.charges.gas_fees.total_gas_cost_apt.toFixed(3)} APT`,
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
      <div className="min-h-screen bg-background dark">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 lg:px-8 text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-wide text-foreground mb-4">
              DASHBOARD
            </h1>
            <p className="text-muted-foreground mb-8">
              Please connect your wallet to access the dashboard.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-wide text-foreground mb-2">
              DASHBOARD
            </h1>
            <p className="text-muted-foreground">
              Manage your autonomous trading agents.
            </p>
          </motion.div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard 
              icon={Wallet}
              label="Total Vault Balance"
              value={`$${vaultStats.total.toFixed(2)}`}
              subValue={`APT: ${vaultStats.aptBalance.toFixed(2)} (${aptChange})`}
              delay={0}
            />
            <StatsCard 
              icon={TrendingUp}
              label="Total P/L"
              value={`+$${vault?.totalRewardsEarned.toFixed(2) || '0.00'}`}
              subValue="All-time vault performance"
              trend={{ value: "0.0%", isPositive: true }}
              delay={0.1}
            />
            <StatsCard 
              icon={Bot}
              label="Active Agents"
              value="0"
              subValue="No agents deployed yet"
              delay={0.2}
            />
            <StatsCard 
              icon={Activity}
              label="APT Price"
              value={aptPrice}
              subValue={`24h: ${aptChange}`}
              trend={{ value: aptChange.replace(/[+\-]/, ''), isPositive: !aptChange.startsWith('-') }}
              delay={0.3}
            />
          </div>
          
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">MY ACTIVE AGENTS</h2>
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
              
              {/* Empty State */}
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
          </motion.div>
          
          {/* Opportunities Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-wide text-foreground">
                      LIVE ARBITRAGE OPPORTUNITIES
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Real-time opportunities detected across Aptos DEXs
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={refreshOpportunities}
                      disabled={marketLoading}
                      className="text-primary"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${marketLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button variant="ghost" size="sm" className="text-primary">
                      View All
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {displayOpportunities.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-6 py-3 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Pair</th>
                        <th className="px-6 py-3 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Route</th>
                        <th className="px-6 py-3 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Spread</th>
                        <th className="px-6 py-3 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Est. Profit</th>
                        <th className="px-6 py-3 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Gas</th>
                        <th className="px-6 py-3 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Risk</th>
                        <th className="px-6 py-3 text-right text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayOpportunities.map((opp, index) => (
                        <motion.tr 
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                <CryptoLogo symbol={opp.pair.split('/')[0] as "APT" | "USDC" | "USDT"} size="sm" />
                                <CryptoLogo symbol={opp.pair.split('/')[1] as "APT" | "USDC" | "USDT"} size="sm" />
                              </div>
                              <span className="font-mono font-semibold text-foreground">{opp.pair}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground">{opp.route}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-semibold text-success">{opp.spread}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-semibold text-foreground">{opp.profit}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm text-muted-foreground">{opp.gas}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono ${getRiskColor(opp.risk)}`}>
                              {opp.risk}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant={opp.isExecutable ? "default" : "ghost"} 
                              size="sm"
                              disabled={!opp.isExecutable}
                            >
                              {opp.isExecutable ? "Execute" : "Low Profit"}
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">
                    {marketLoading ? "Loading Opportunities..." : "No Opportunities Found"}
                  </h3>
                  <p className="text-muted-foreground">
                    {marketLoading 
                      ? "Scanning DEXs for arbitrage opportunities..." 
                      : "No profitable arbitrage opportunities detected at the moment."
                    }
                  </p>
                </div>
              )}
              
              {displayOpportunities.length > 0 && (
                <div className="p-4 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground">
                    Showing {displayOpportunities.length} of {opportunities.length} opportunities
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
