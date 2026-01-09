import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Upload, Wallet, RefreshCw, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import CryptoLogo from "@/components/CryptoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/hooks/useVault";
import { useMarketData } from "@/hooks/useMarketData";
import { useSmartContractVault } from "@/hooks/useSmartContractVault";
import { balanceService } from "@/services/BalanceService";

const Vault = () => {
  const { account, connected } = useWallet();
  const { vault, transactions, isLoading, error, refreshVault, refreshTransactions, getFormattedBalance } = useVault();
  const { tokenPrices } = useMarketData();
  const { 
    isProcessing: contractProcessing, 
    error: contractError, 
    depositAPTDirectToVault,
    depositTokenToVault,
    withdrawFromVault, 
    clearError: clearContractError 
  } = useSmartContractVault();

  const [selectedToken, setSelectedToken] = useState<"APT" | "USDC" | "USDT">("APT");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [walletBalances, setWalletBalances] = useState<{ APT: string; USDC: string; USDT: string }>({ APT: '0', USDC: '0', USDT: '0' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const supportedTokens: Array<{ symbol: "APT" | "USDC" | "USDT"; name: string }> = [
    { symbol: "APT", name: "Aptos" },
    { symbol: "USDC", name: "USD Coin" },
    { symbol: "USDT", name: "Tether USD" },
  ];

  useEffect(() => {
    const loadWalletBalances = async () => {
      if (!account?.address) return;
      try {
        const aptBalance = await balanceService.fetchAPTBalance(account.address);
        const usdcBalance = await balanceService.fetchUSDCBalance(account.address);
        const usdtBalance = await balanceService.fetchUSDTBalance(account.address);
        setWalletBalances({ APT: aptBalance, USDC: usdcBalance, USDT: usdtBalance });
      } catch (err) {
        setWalletBalances({ APT: '0', USDC: '0', USDT: '0' });
      }
    };
    if (connected && account?.address) {
      loadWalletBalances();
      const interval = setInterval(loadWalletBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [account?.address, connected]);

  const getTokenData = (symbol: "APT" | "USDC" | "USDT") => {
    const vaultBalance = getFormattedBalance(symbol);
    const walletBalance = walletBalances[symbol] || '0';
    const priceData = tokenPrices[symbol];
    const balance = parseFloat(vaultBalance) || 0;
    const price = priceData?.priceNum || 0;
    const usdValue = balance * price;
    return {
      symbol,
      balance: vaultBalance,
      walletBalance,
      usdValue: `$${(Math.floor(usdValue * 100) / 100).toFixed(2)}`,
      price: priceData ? `$${priceData.priceNum.toFixed(2)}` : '$0.00',
      change: priceData?.change || '0.0%',
      isPositive: priceData?.change?.startsWith('+') ?? true
    };
  };

  const tokens = supportedTokens.map(token => getTokenData(token.symbol));
  const selectedTokenData = tokens.find(t => t.symbol === selectedToken);

  const handleDeposit = async () => {
    if (!account?.address || !depositAmount || isProcessing || contractProcessing) return;
    setIsProcessing(true);
    clearContractError();
    setLocalError(null);
    try {
      let success = false;
      if (selectedToken === 'APT') {
        success = await depositAPTDirectToVault(depositAmount);
      } else {
        const walletBalance = parseFloat(walletBalances[selectedToken] || '0');
        if (parseFloat(depositAmount) > walletBalance) {
          setLocalError(`Insufficient ${selectedToken} balance`);
          setIsProcessing(false);
          return;
        }
        success = await depositTokenToVault(depositAmount, selectedToken);
      }
      if (success) {
        setDepositAmount("");
        const newBalances = await balanceService.refreshBalances(account.address);
        setWalletBalances(newBalances);
        await refreshVault();
        await refreshTransactions();
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!account?.address || !withdrawAmount || isProcessing || contractProcessing) return;
    setIsProcessing(true);
    clearContractError();
    try {
      const success = await withdrawFromVault(withdrawAmount, selectedToken);
      if (success) {
        setWithdrawAmount("");
        const newBalances = await balanceService.refreshBalances(account.address);
        setWalletBalances(newBalances);
        await refreshVault();
        await refreshTransactions();
      }
    } catch (err) {
      console.error('Withdraw error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const setPercentage = (percentage: number, isDeposit: boolean) => {
    const balance = isDeposit ? selectedTokenData?.walletBalance : selectedTokenData?.balance;
    if (!balance) return;
    const amount = (parseFloat(balance) * percentage / 100).toFixed(6);
    if (isDeposit) setDepositAmount(amount);
    else setWithdrawAmount(amount);
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center p-8 rounded-xl border border-border bg-card">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground">Connect your wallet to access the vault</p>
        </div>
      </div>
    );
  }

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
          
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-2">
              <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-wide text-foreground">
                VAULT
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshVault}
                disabled={isLoading}
                className="text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-muted-foreground">
              Securely deposit and withdraw funds for your agents.
            </p>
          </motion.div>

          {/* Balance Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          >
            {tokens.map((token) => (
              <div
                key={token.symbol}
                className={`rounded-xl border p-5 transition-all cursor-pointer ${
                  selectedToken === token.symbol 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card hover:border-primary/50"
                }`}
                onClick={() => setSelectedToken(token.symbol)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <CryptoLogo symbol={token.symbol} size="md" />
                    <div>
                      <p className="font-display font-bold text-foreground">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground">Vault</p>
                    </div>
                  </div>
                  <span className={`text-xs font-mono ${token.isPositive ? "text-success" : "text-destructive"}`}>
                    {token.change}
                  </span>
                </div>
                <p className="font-mono text-xl font-bold text-foreground">{token.balance}</p>
                <p className="text-sm text-muted-foreground">{token.usdValue}</p>
                <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  Wallet: <span className="font-mono text-foreground">{token.walletBalance}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Deposit/Withdraw Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            {/* Deposit Panel */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">DEPOSIT</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Token</label>
                  <div className="flex gap-2">
                    {supportedTokens.map((token) => (
                      <button
                        key={token.symbol}
                        onClick={() => setSelectedToken(token.symbol)}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-mono text-sm transition-all flex items-center justify-center gap-2 ${
                          selectedToken === token.symbol
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        <CryptoLogo symbol={token.symbol} size="sm" />
                        {token.symbol}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Amount</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="font-mono text-lg h-12 pr-16 bg-muted border-border"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CryptoLogo symbol={selectedToken} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      Available: {selectedTokenData?.walletBalance || '0'}
                    </span>
                    <div className="flex gap-1">
                      {[25, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setPercentage(pct, true)}
                          className="px-2 py-1 text-xs font-mono bg-muted rounded hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors"
                        >
                          {pct === 100 ? 'MAX' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="default" 
                  size="lg" 
                  className="w-full font-display tracking-wide font-bold"
                  onClick={handleDeposit}
                  disabled={!depositAmount || isProcessing || isLoading}
                >
                  {isProcessing ? 'Processing...' : 'Deposit'}
                </Button>
              </div>
            </div>
            
            {/* Withdraw Panel */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 border border-warning/20">
                  <Upload className="h-5 w-5 text-warning" />
                </div>
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">WITHDRAW</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Token</label>
                  <div className="flex gap-2">
                    {supportedTokens.map((token) => (
                      <button
                        key={token.symbol}
                        onClick={() => setSelectedToken(token.symbol)}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-mono text-sm transition-all flex items-center justify-center gap-2 ${
                          selectedToken === token.symbol
                            ? "bg-warning/20 text-warning border border-warning/30"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        <CryptoLogo symbol={token.symbol} size="sm" />
                        {token.symbol}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Amount</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="font-mono text-lg h-12 pr-16 bg-muted border-border"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CryptoLogo symbol={selectedToken} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      Vault: {selectedTokenData?.balance || '0'}
                    </span>
                    <div className="flex gap-1">
                      {[25, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setPercentage(pct, false)}
                          className="px-2 py-1 text-xs font-mono bg-muted rounded hover:bg-warning/20 hover:text-warning text-muted-foreground transition-colors"
                        >
                          {pct === 100 ? 'MAX' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full font-display tracking-wide font-bold border-warning/50 text-warning hover:bg-warning/10"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || isProcessing || isLoading}
                >
                  {isProcessing ? 'Processing...' : 'Withdraw'}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Error Display */}
          {(error || contractError || localError) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-destructive text-sm">{error || contractError || localError}</span>
                <button
                  onClick={() => {
                    if (contractError) clearContractError();
                    if (localError) setLocalError(null);
                  }}
                  className="text-destructive hover:text-destructive/80"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}

          {/* Transaction History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-lg font-bold tracking-wide text-foreground">TRANSACTIONS</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshTransactions}
                className="text-muted-foreground hover:text-primary"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="divide-y divide-border">
              {transactions.length > 0 ? (
                transactions.slice(0, 5).map((tx, index) => (
                  <div key={tx.transactionHash || index} className="px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        tx.type === "deposit" ? "bg-success/10" : "bg-warning/10"
                      }`}>
                        {tx.type === "deposit" ? (
                          <Download className="h-4 w-4 text-success" />
                        ) : (
                          <Upload className="h-4 w-4 text-warning" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CryptoLogo symbol={tx.coinSymbol as "APT" | "USDC" | "USDT"} size="sm" />
                        <div>
                          <p className={`font-mono font-semibold ${tx.type === "deposit" ? "text-success" : "text-warning"}`}>
                            {tx.type === "deposit" ? "+" : "-"}{tx.amountFormatted} {tx.coinSymbol}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono ${
                        tx.status === 'confirmed' 
                          ? 'bg-success/10 text-success' 
                          : tx.status === 'pending'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {tx.status}
                      </span>
                      <a 
                        href={`https://explorer.aptoslabs.com/txn/${tx.transactionHash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        {tx.transactionHash.slice(0, 6)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-12 text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm">No transactions yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Vault;
