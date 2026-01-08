import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, Play, Square, Settings, Wallet, 
  Activity, Zap, Shield, Target, Clock,
  TrendingUp, AlertTriangle, CheckCircle, Search
} from "lucide-react";
import Header from "@/components/Header";
import PriceChart from "@/components/PriceChart";
import Terminal from "@/components/Terminal";
import CryptoLogo from "@/components/CryptoLogo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const Agents = () => {
  const [minProfit, setMinProfit] = useState([0.5]);
  const [selectedPair, setSelectedPair] = useState("AUTO");
  const [riskLevel, setRiskLevel] = useState("MEDIUM");
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  
  const isConnected = true;
  const walletAddress = "0x1a2b3c4d5e6f7890abcdef1234567890abcd3f4c";
  
  const pairs = [
    { value: "USDC_APT", label: "USDC → APT" },
    { value: "APT_USDT", label: "APT → USDT" },
    { value: "USDC_USDT", label: "USDC → USDT" },
    { value: "AUTO", label: "AUTO (All Pairs)" },
  ];
  
  const riskLevels = [
    { value: "LOW", maxTrade: "$2,500", gasLimit: "0.003 APT", stopLoss: "-1%" },
    { value: "MEDIUM", maxTrade: "$5,000", gasLimit: "0.005 APT", stopLoss: "-2%" },
    { value: "HIGH", maxTrade: "$10,000", gasLimit: "0.01 APT", stopLoss: "-5%" },
  ];
  
  const selectedRisk = riskLevels.find(r => r.value === riskLevel);
  
  const logs = [
    { time: "10:34:21", type: "SCAN" as const, message: "Scanning Liquidswap...", detail: "Found opportunity: USDC→APT | Spread: 0.8% | Est. Profit: $42.50" },
    { time: "10:34:24", type: "EXECUTE" as const, message: "Trade executed successfully", detail: "Route: USDC→APT→USDT | Profit: $38.20 (after gas)" },
    { time: "10:34:30", type: "WARNING" as const, message: "High slippage detected", detail: "Opportunity skipped (2.5% slippage threshold exceeded)" },
    { time: "10:34:35", type: "SCAN" as const, message: "Scanning PancakeSwap...", detail: "All spreads below minimum threshold" },
    { time: "10:34:42", type: "INFO" as const, message: "Market analysis complete", detail: "Analyzing 12 pairs across 4 DEXs" },
    { time: "10:34:48", type: "SCAN" as const, message: "Scanning Pontem DEX...", detail: "Potential opportunity detected" },
  ];
  
  const vaultBalances = [
    { token: "APT" as const, amount: "500.0", usd: "$7,500.00" },
    { token: "USDC" as const, amount: "250.0", usd: "$250.00" },
    { token: "USDT" as const, amount: "100.0", usd: "$100.00" },
  ];

  return (
    <div className="min-h-screen bg-background dark">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Back Link */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link 
              to="/dashboard" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </motion.div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Agent Configuration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-1 space-y-6"
            >
              {/* Config Panel */}
              <div className="rounded-xl border border-border bg-card p-6 sticky top-24">
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground mb-6 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  AGENT CONFIGURATION
                </h2>
                
                {/* Min Profitability */}
                <div className="mb-6">
                  <label className="text-sm text-muted-foreground mb-3 block font-display">
                    Minimum Profit Threshold
                  </label>
                  <Slider
                    value={minProfit}
                    onValueChange={setMinProfit}
                    min={0.1}
                    max={5}
                    step={0.1}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Min: 0.1%</span>
                    <span className="font-mono font-semibold text-primary">{minProfit[0].toFixed(1)}%</span>
                    <span className="text-muted-foreground">Max: 5.0%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Only execute trades with profit ≥ {minProfit[0].toFixed(1)}%
                  </p>
                </div>
                
                {/* Trading Pairs */}
                <div className="mb-6">
                  <label className="text-sm text-muted-foreground mb-3 block font-display">
                    Trading Pairs
                  </label>
                  <div className="space-y-2">
                    {pairs.map((pair) => (
                      <label
                        key={pair.value}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                          selectedPair === pair.value
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted/50 border-transparent hover:bg-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="pair"
                          value={pair.value}
                          checked={selectedPair === pair.value}
                          onChange={(e) => setSelectedPair(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedPair === pair.value ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {selectedPair === pair.value && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className={`font-mono text-sm ${
                          selectedPair === pair.value ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {pair.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Risk Level */}
                <div className="mb-6">
                  <label className="text-sm text-muted-foreground mb-3 block font-display">
                    Risk Tolerance
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["LOW", "MEDIUM", "HIGH"].map((level) => (
                      <button
                        key={level}
                        onClick={() => setRiskLevel(level)}
                        className={`py-2 px-3 rounded-lg font-display text-sm font-bold transition-all ${
                          riskLevel === level
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  {selectedRisk && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">Max trade:</span>
                        <span className="font-mono text-foreground">{selectedRisk.maxTrade}</span>
                        <span className="text-muted-foreground">Gas limit:</span>
                        <span className="font-mono text-foreground">{selectedRisk.gasLimit}</span>
                        <span className="text-muted-foreground">Stop loss:</span>
                        <span className="font-mono text-foreground">{selectedRisk.stopLoss}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="space-y-3">
                  {!isAgentRunning ? (
                    <Button 
                      variant="glow" 
                      size="lg" 
                      className="w-full font-display tracking-wide font-bold"
                      onClick={() => setIsAgentRunning(true)}
                    >
                      <Play className="h-5 w-5" />
                      START AGENT
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="w-full font-display tracking-wide font-bold border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => setIsAgentRunning(false)}
                    >
                      <Square className="h-5 w-5" />
                      STOP AGENT
                    </Button>
                  )}
                  
                  {isAgentRunning && (
                    <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
                      <div className="flex items-center justify-center gap-2 text-success">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="font-display tracking-wide font-bold">AGENT ACTIVE</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Running for: 2h 34m</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Vault Balances Widget */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display tracking-wide font-bold text-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    VAULT BALANCES
                  </h3>
                </div>
                {vaultBalances.map((balance) => (
                  <div key={balance.token} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <CryptoLogo symbol={balance.token} size="sm" />
                      <span className="font-mono text-muted-foreground">{balance.token}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-foreground">{balance.amount}</p>
                      <p className="text-xs text-muted-foreground">{balance.usd}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-mono font-bold text-lg text-primary">$7,850.00</span>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                  <Link to="/vault">Go to Vault →</Link>
                </Button>
              </div>
            </motion.div>
            
            {/* Right: Chart & Logs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Price Chart */}
              <PriceChart />
              
              {/* Live Agent Logs - Terminal Style */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display tracking-wide font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    LIVE AGENT LOGS
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs">Clear</Button>
                    <Button variant="ghost" size="sm" className="text-xs">Export</Button>
                  </div>
                </div>
                
                {isAgentRunning ? (
                  <Terminal 
                    logs={logs}
                    title="arbigent@aptos-testnet: ~/agent_logs"
                    maxHeight="400px"
                  />
                ) : (
                  <div className="terminal rounded-lg overflow-hidden">
                    <div className="terminal-header flex items-center gap-2 px-4 py-3 bg-[hsl(220,13%,14%)] border-b border-[hsl(220,9%,22%)]">
                      <div className="flex gap-2">
                        <div className="terminal-dot-red" />
                        <div className="terminal-dot-yellow" />
                        <div className="terminal-dot-green" />
                      </div>
                      <span className="ml-4 text-sm text-gray-400 font-mono">arbigent@aptos-testnet</span>
                    </div>
                    <div className="terminal-body bg-[hsl(220,13%,10%)] p-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(220,13%,18%)] mx-auto mb-3">
                        <Shield className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-gray-400">Agent is not running</p>
                      <p className="text-xs text-gray-600 mt-1">Start an agent to see live logs</p>
                      <div className="mt-4 flex items-center justify-center">
                        <span className="text-primary">→</span>
                        <span className="text-gray-400 ml-2">~</span>
                        <span className="ml-2 text-gray-600">awaiting command...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Agents;
