import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bot, Shield, Target, TrendingUp, ArrowRight, Zap, Radio } from "lucide-react";
import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import PriceChart from "@/components/PriceChart";
import { WalletConnectionPrompt } from "@/components/WalletConnectionPrompt";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);

  const handleConnect = () => {
    if (connected) {
      navigate("/dashboard");
    } else {
      setShowWalletPrompt(true);
    }
  };

  const handleCloseWalletPrompt = () => {
    setShowWalletPrompt(false);
  };

  const features = [
    {
      icon: Bot,
      title: "AUTONOMOUS AGENTS",
      description: "AI agents execute trades 24/7 without manual intervention. Sleep while your agents work.",
      badge: "ALWAYS ON",
      badgeColor: "green" as const,
    },
    {
      icon: Shield,
      title: "LOW RISK EXECUTION",
      description: "Risk-assessed strategies with built-in safety limits and MEV protection.",
      badge: "RISK SCORE: 2.3/10",
      badgeColor: "green" as const,
    },
    {
      icon: Target,
      title: "HIGH SUCCESS RATE",
      description: "92.7% profitable trades over 30 days with advanced opportunity detection.",
      badge: "1,247 TRADES",
      badgeColor: "blue" as const,
    },
    {
      icon: TrendingUp,
      title: "MAXIMUM PROFITABILITY",
      description: "Average 0.8% profit per trade, compounded automatically across DEXs.",
      badge: "+$47,332 TOTAL",
      badgeColor: "green" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background noise-overlay dark">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-1.5s' }} />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: Hero Content */}
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
                  <Radio className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-sm font-display font-bold text-primary">APTOS TESTNET</span>
                </div>
                
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-none tracking-wide mb-6 text-gradient-hero">
                  AGENTIC<br />
                  ARBITRAGE<br />
                  PLATFORM
                </h1>
                
                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  Deploy autonomous agents that scan Aptos DEXs 24/7, 
                  executing profitable arbitrage trades while you sleep.
                  Confidential computation meets unstoppable execution.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="hero" size="xl" onClick={handleConnect}>
                    {connected ? 'Launch App' : 'Connect Wallet'}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="xl" className="font-display tracking-wide font-bold">
                    Learn More
                  </Button>
                </div>
              </motion.div>
              
              {/* Feature Cards Grid */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <FeatureCard
                    key={feature.title}
                    {...feature}
                    delay={0.2 + index * 0.1}
                  />
                ))}
              </div>
            </div>
            
            {/* Right: Price Chart */}
            <div className="lg:pl-8">
              <PriceChart />
              
              {/* Additional Info Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-6 grid grid-cols-2 gap-4"
              >
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
                  <p className="text-xs text-muted-foreground mb-1 font-display">Active Arbitrage Routes</p>
                  <p className="font-mono text-xl font-bold text-foreground">47</p>
                  <p className="text-xs text-success mt-1">+12 new today</p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
                  <p className="text-xs text-muted-foreground mb-1 font-display">Total Value Locked</p>
                  <p className="font-mono text-xl font-bold text-foreground">$2.4M</p>
                  <p className="text-xs text-success mt-1">+8.3% this week</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-wide mb-4 text-foreground">
              A LOOK INSIDE THE ENGINE
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our architecture separates private computation from public settlement, 
              giving you the best of both worlds.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Shield,
                title: "CONFIDENTIAL COMPUTE",
                description: "Your logic runs privately in a zkVM. No one sees your strategy, inputs, or state.",
              },
              {
                icon: Target,
                title: "ZK PROOF GENERATION",
                description: "A cryptographic proof is generated, confirming your logic executed correctly without revealing it.",
              },
              {
                icon: Zap,
                title: "MEV RESISTANCE",
                description: "Transactions are sent via private mempool, protecting you from sandwich attacks.",
              },
              {
                icon: Bot,
                title: "NON-CUSTODIAL",
                description: "You retain full control of your assets. On-chain contracts verify proofs, settling trades trustlessly.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group rounded-xl border border-border bg-card p-6 hover:border-primary/50 transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold tracking-wide text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-12 text-center"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
            
            <div className="relative z-10">
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-wide mb-4 text-foreground">
                START TRADING WITH AI
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Connect your Petra wallet and deploy your first autonomous trading agent in minutes.
              </p>
              <Button variant="glow" size="xl" onClick={handleConnect} className="font-display tracking-wide font-bold">
                {connected ? 'Launch App' : 'Connect Petra Wallet'}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <p className="text-sm text-muted-foreground mt-4">No trading fees for first 30 days</p>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-bold tracking-wide">ARBIGENT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Arbigent. Built on Aptos.
            </p>
          </div>
        </div>
      </footer>

      {/* Wallet Connection Modal */}
      {showWalletPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative max-w-md w-full">
            <button
              onClick={handleCloseWalletPrompt}
              className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              ×
            </button>
            <WalletConnectionPrompt
              title="Connect to Start Trading"
              description="Connect your Petra wallet to access the dashboard and start deploying autonomous trading agents."
              targetRoute="/dashboard"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
