import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Upload, Wallet, RefreshCw, ExternalLink, Coins, Zap } from "lucide-react";
import Header from "@/components/Header";
import CryptoLogo from "@/components/CryptoLogo";
import WalletDebug from "@/components/WalletDebug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useVault } from "@/hooks/useVault";
import { useMarketData } from "@/hooks/useMarketData";
import { useSmartContractVault } from "@/hooks/useSmartContractVault";
import { balanceService } from "@/services/BalanceService";

const Vault = () => {
  const { account, connected } = useWallet();
  const { vault, balances, transactions, isLoading, error, refreshVault, refreshTransactions, deposit, withdraw, getFormattedBalance } = useVault();
  const { tokenPrices } = useMarketData();
  const { 
    isProcessing: contractProcessing, 
    error: contractError, 
    depositAPTtoVault, 
    depositAPTDirectToVault,
    depositTokenToVault,
    withdrawFromVault, 
    mintTestTokens,
    swapTokens,
    clearError: clearContractError 
  } = useSmartContractVault();
  
  const [selectedToken, setSelectedToken] = useState<"APT" | "USDC" | "USDT">("APT");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapFromToken, setSwapFromToken] = useState<"USDC" | "USDT">("USDC");
  const [swapToToken, setSwapToToken] = useState<"USDC" | "USDT">("USDT");
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Supported tokens with their configurations
  const supportedTokens: Array<{ symbol: "APT" | "USDC" | "USDT"; name: string }> = [
    { symbol: "APT", name: "Aptos" },
    { symbol: "USDC", name: "USD Coin" },
    { symbol: "USDT", name: "Tether USD" },
  ];

  // Load wallet balances with enhanced debugging
  useEffect(() => {
    const loadWalletBalances = async () => {
      if (!account?.address) return;
      
      try {
        console.log('🔍 Loading wallet balances for:', account.address);
        
        // Test individual balance fetching
        const aptBalance = await balanceService.fetchAPTBalance(account.address);
        console.log('💰 APT Balance:', aptBalance);
        
        const usdcBalance = await balanceService.fetchUSDCBalance(account.address);
        console.log('💰 USDC Balance:', usdcBalance);
        
        const usdtBalance = await balanceService.fetchUSDTBalance(account.address);
        console.log('💰 USDT Balance:', usdtBalance);
        
        const allBalances = { APT: aptBalance, USDC: usdcBalance, USDT: usdtBalance };
        console.log('📊 All Balances:', allBalances);
        
        setWalletBalances(allBalances);
      } catch (err) {
        console.error('❌ Failed to load wallet balances:', err);
        // Set empty balances on error to prevent UI issues
        setWalletBalances({ APT: '0', USDC: '0', USDT: '0' });
      }
    };

    if (connected && account?.address) {
      loadWalletBalances();
      // Also refresh balances every 30 seconds
      const interval = setInterval(loadWalletBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [account?.address, connected]);

  // Get token data with real prices and vault balances
  const getTokenData = (symbol: "APT" | "USDC" | "USDT") => {
    const vaultBalance = getFormattedBalance(symbol);
    const walletBalance = walletBalances[symbol] || '0';
    const priceData = tokenPrices[symbol];
    
    // Calculate USD value using priceNum (numeric price from Coinbase API)
    const balance = parseFloat(vaultBalance) || 0;
    const price = priceData?.priceNum || 0;
    const usdValue = balance * price;
    
    return {
      symbol,
      balance: vaultBalance,
      walletBalance,
      usdValue: `${(Math.floor(usdValue * 100) / 100).toFixed(2)}`,
      price: priceData ? `$${priceData.priceNum.toFixed(4)}` : '$0.00',
      change: priceData?.change || '0.0%',
      isPositive: priceData?.change?.startsWith('+') ?? true
    };
  };

  const tokens = supportedTokens.map(token => getTokenData(token.symbol));
  const selectedTokenData = tokens.find(t => t.symbol === selectedToken);

  // Handle deposit using smart contract
  const handleDeposit = async () => {
    if (!account?.address || !depositAmount || isProcessing || contractProcessing) return;
    
    setIsProcessing(true);
    clearContractError();
    setLocalError(null);
    
    try {
      if (selectedToken === 'APT') {
        // For APT deposits, deposit APT directly to vault (no conversion)
        const success = await depositAPTDirectToVault(depositAmount);
        
        if (success) {
          setDepositAmount("");
          // Refresh balances
          const newBalances = await balanceService.refreshBalances(account.address);
          setWalletBalances(newBalances);
          await refreshVault();
          await refreshTransactions(); // Refresh transaction history
        }
      } else if (selectedToken === 'USDC' || selectedToken === 'USDT') {
        // For USDC/USDT deposits, transfer tokens from wallet to vault
        console.log(`🔥 Depositing ${selectedToken}:`, {
          amount: depositAmount,
          walletBalance: walletBalances[selectedToken]
        });

        // Check if user has enough balance
        const walletBalance = parseFloat(walletBalances[selectedToken] || '0');
        const depositAmountNum = parseFloat(depositAmount);
        
        if (depositAmountNum > walletBalance) {
          setLocalError(`Insufficient ${selectedToken} balance. You have ${walletBalance} ${selectedToken}`);
          return;
        }

        // Use the smart contract vault function to transfer tokens
        const success = await depositTokenToVault(depositAmount, selectedToken);
        
        if (success) {
          setDepositAmount("");
          // Refresh both wallet and vault balances
          const newBalances = await balanceService.refreshBalances(account.address);
          setWalletBalances(newBalances);
          await refreshVault();
          await refreshTransactions(); // Refresh transaction history
          
          setLocalError(null); // Clear any previous errors
        }
      }
    } catch (err) {
      console.error('Deposit error:', err);
      setLocalError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle withdrawal using smart contract
  const handleWithdraw = async () => {
    if (!account?.address || !withdrawAmount || isProcessing || contractProcessing) return;
    
    setIsProcessing(true);
    clearContractError();
    
    try {
      // Use smart contract for all withdrawals (APT, USDC, USDT)
      const success = await withdrawFromVault(withdrawAmount, selectedToken);
      
      if (success) {
        setWithdrawAmount("");
        // Refresh balances
        const newBalances = await balanceService.refreshBalances(account.address);
        setWalletBalances(newBalances);
        await refreshVault();
        await refreshTransactions(); // Refresh transaction history
      }
    } catch (err) {
      console.error('Withdraw error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle test token minting
  const handleMintTokens = async (token: 'USDC' | 'USDT') => {
    if (!mintAmount || contractProcessing) return;
    
    const success = await mintTestTokens(token, mintAmount);
    
    if (success && account?.address) {
      setMintAmount("");
      // Refresh balances
      const newBalances = await balanceService.refreshBalances(account.address);
      setWalletBalances(newBalances);
    }
  };

  // Handle token swapping
  const handleSwapTokens = async () => {
    if (!swapAmount || contractProcessing || swapFromToken === swapToToken) return;
    
    const success = await swapTokens(swapFromToken, swapToToken, swapAmount);
    
    if (success && account?.address) {
      setSwapAmount("");
      // Refresh balances
      const newBalances = await balanceService.refreshBalances(account.address);
      setWalletBalances(newBalances);
    }
  };

  // Set percentage of available balance
  const setPercentage = (percentage: number, isDeposit: boolean) => {
    const balance = isDeposit ? selectedTokenData?.walletBalance : selectedTokenData?.balance;
    if (!balance) return;
    
    const amount = (parseFloat(balance) * percentage / 100).toString();
    if (isDeposit) {
      setDepositAmount(amount);
    } else {
      setWithdrawAmount(amount);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Wallet Not Connected</h2>
          <p className="text-muted-foreground">Please connect your wallet to access the vault.</p>
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
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-wide text-foreground">
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
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
          </motion.div>
          
          {/* Debug Section - Temporary */}
          

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
                className={`rounded-xl border p-6 transition-all cursor-pointer ${
                  selectedToken === token.symbol 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card hover:border-primary/50"
                }`}
                onClick={() => setSelectedToken(token.symbol)}
              >
                <div className="flex items-center gap-3 mb-4">
                  <CryptoLogo symbol={token.symbol} size="lg" />
                  <div>
                    <p className="font-display font-bold text-lg text-foreground">{token.symbol}</p>
                    <p className="text-xs text-muted-foreground">Vault Balance</p>
                  </div>
                </div>
                <p className="font-mono text-2xl font-bold text-foreground mb-1">
                  {token.balance} {token.symbol}
                </p>
                <p className="text-sm text-muted-foreground mb-2">≈ {token.usdValue} USD</p>
                <div className="text-xs text-muted-foreground">
                  Wallet: {token.walletBalance} {token.symbol}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price: {token.price}</span>
                  <span className={token.isPositive ? "text-success" : "text-destructive"}>
                    {token.change}
                  </span>
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
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">DEPOSIT FUNDS</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Select Currency</label>
                  <div className="flex gap-2">
                    {supportedTokens.map((token) => (
                      <button
                        key={token.symbol}
                        onClick={() => setSelectedToken(token.symbol)}
                        className={`flex-1 py-2 px-4 rounded-lg font-mono text-sm transition-all flex items-center justify-center gap-2 ${
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
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Enter Amount</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="font-mono text-xl h-14 pr-20 bg-muted border-border"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <CryptoLogo symbol={selectedToken} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">
                      Available: {selectedTokenData?.walletBalance || '0'} {selectedToken}
                    </span>
                    <div className="flex gap-2">
                      {["25%", "50%", "75%", "MAX"].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setPercentage(parseInt(pct) || 100, true)}
                          className="px-2 py-1 text-xs font-mono bg-muted rounded hover:bg-primary/20 hover:text-primary text-muted-foreground transition-colors"
                        >
                          {pct}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Gas</span>
                      <span className="font-mono text-foreground">0.002 APT</span>
                    </div>
                    {selectedToken === 'APT' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Exchange Rate</span>
                          <span className="font-mono text-foreground">1 APT ≈ 0.08 USDC</span>
                        </div>
                        {depositAmount && parseFloat(depositAmount) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Depositing</span>
                            <span className="font-mono text-foreground">{depositAmount} APT</span>
                          </div>
                        )}
                      </>
                    )}
                    {depositAmount && selectedToken === 'APT' && parseFloat(depositAmount) > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">You'll receive</span>
                          <span className="font-mono text-foreground">
                            ≈ {(parseFloat(depositAmount) * 0.08).toFixed(4)} USDC
                          </span>
                        </div>
                        {parseFloat(depositAmount) < 0.1 && (
                          <div className="text-xs text-warning">
                            ⚠️ Small amounts may result in minimal USDC due to 0.08 exchange rate
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                <Button 
                  variant="glow" 
                  size="lg" 
                  className="w-full font-display tracking-wide font-bold"
                  onClick={handleDeposit}
                  disabled={!depositAmount || isProcessing || isLoading}
                >
                  {isProcessing ? 'PROCESSING...' : 'DEPOSIT TO VAULT'}
                </Button>
              </div>
            </div>
            
            {/* Withdraw Panel */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 border border-warning/20">
                  <Upload className="h-5 w-5 text-warning" />
                </div>
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">WITHDRAW FUNDS</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Select Currency</label>
                  <div className="flex gap-2">
                    {supportedTokens.map((token) => (
                      <button
                        key={token.symbol}
                        onClick={() => setSelectedToken(token.symbol)}
                        className={`flex-1 py-2 px-4 rounded-lg font-mono text-sm transition-all flex items-center justify-center gap-2 ${
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
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Enter Amount</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="font-mono text-xl h-14 pr-20 bg-muted border-border"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <CryptoLogo symbol={selectedToken} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">
                      Vault Balance: {selectedTokenData?.balance || '0'} {selectedToken}
                    </span>
                    <div className="flex gap-2">
                      {["25%", "50%", "75%", "MAX"].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setPercentage(parseInt(pct) || 100, false)}
                          className="px-2 py-1 text-xs font-mono bg-muted rounded hover:bg-warning/20 hover:text-warning text-muted-foreground transition-colors"
                        >
                          {pct}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Gas</span>
                    <span className="font-mono text-foreground">0.002 APT</span>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full font-display tracking-wide font-bold border-warning/50 text-warning hover:bg-warning/10"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || isProcessing || isLoading}
                >
                  {isProcessing ? 'PROCESSING...' : 'WITHDRAW FROM VAULT'}
                </Button>
              </div>
            </div>
          </motion.div>
          
          {/* Smart Contract Testing Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            {/* Token Minting Panel */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 border border-success/20">
                  <Coins className="h-5 w-5 text-success" />
                </div>
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">MINT TEST TOKENS</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Select Token</label>
                  <div className="flex gap-2">
                    {["USDC", "USDT"].map((token) => (
                      <button
                        key={token}
                        onClick={() => setSelectedToken(token as "USDC" | "USDT")}
                        className={`flex-1 py-2 px-4 rounded-lg font-mono text-sm transition-all flex items-center justify-center gap-2 ${
                          selectedToken === token
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        <CryptoLogo symbol={token as "USDC" | "USDT"} size="sm" />
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Mint Amount</label>
                  <Input
                    type="number"
                    placeholder="100.00"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    className="font-mono text-xl h-14 bg-muted border-border"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1 font-display tracking-wide font-bold border-success/50 text-success hover:bg-success/10"
                    onClick={() => handleMintTokens('USDC')}
                    disabled={!mintAmount || contractProcessing}
                  >
                    {contractProcessing ? 'MINTING...' : 'MINT USDC'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1 font-display tracking-wide font-bold border-success/50 text-success hover:bg-success/10"
                    onClick={() => handleMintTokens('USDT')}
                    disabled={!mintAmount || contractProcessing}
                  >
                    {contractProcessing ? 'MINTING...' : 'MINT USDT'}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Token Swapping Panel */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 border border-info/20">
                  <Zap className="h-5 w-5 text-info" />
                </div>
                <h2 className="font-display text-xl font-bold tracking-wide text-foreground">SWAP TOKENS</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-display">From</label>
                    <select
                      value={swapFromToken}
                      onChange={(e) => setSwapFromToken(e.target.value as "USDC" | "USDT")}
                      className="w-full py-2 px-4 rounded-lg font-mono text-sm bg-muted border border-border text-foreground"
                    >
                      <option value="USDC">USDC</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-display">To</label>
                    <select
                      value={swapToToken}
                      onChange={(e) => setSwapToToken(e.target.value as "USDC" | "USDT")}
                      className="w-full py-2 px-4 rounded-lg font-mono text-sm bg-muted border border-border text-foreground"
                    >
                      <option value="USDC">USDC</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block font-display">Swap Amount</label>
                  <Input
                    type="number"
                    placeholder="50.00"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    className="font-mono text-xl h-14 bg-muted border-border"
                  />
                  <div className="mt-2 text-sm text-muted-foreground">
                    Available: {walletBalances[swapFromToken] || '0'} {swapFromToken}
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full font-display tracking-wide font-bold border-info/50 text-info hover:bg-info/10"
                  onClick={handleSwapTokens}
                  disabled={!swapAmount || contractProcessing || swapFromToken === swapToToken}
                >
                  {contractProcessing ? 'SWAPPING...' : `SWAP ${swapFromToken} → ${swapToToken}`}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Error Display */}
          {(error || contractError || localError) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-display font-bold">Error:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (contractError) clearContractError();
                    if (localError) setLocalError(null);
                  }}
                  className="ml-auto text-destructive hover:text-destructive/80"
                >
                  ✕
                </Button>
              </div>
              <p className="text-sm">{error || contractError || localError}</p>
            </motion.div>
          )}

          {/* Transaction History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-xl font-bold tracking-wide text-foreground">RECENT TRANSACTIONS</h2>
              <div className="flex gap-2">
                {["All", "Deposits", "Withdrawals"].map((tab) => (
                  <button
                    key={tab}
                    className="px-3 py-1.5 text-sm rounded-lg font-mono bg-muted hover:bg-muted/80 text-muted-foreground"
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="divide-y divide-border">
              {transactions.length > 0 ? (
                transactions.map((tx, index) => (
                  <div key={index} className="px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        tx.type === "deposit" ? "bg-success/10" : "bg-warning/10"
                      }`}>
                        {tx.type === "deposit" ? (
                          <Download className="h-5 w-5 text-success" />
                        ) : (
                          <Upload className="h-5 w-5 text-warning" />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <CryptoLogo symbol={tx.coinSymbol as "APT" | "USDC" | "USDT"} size="sm" />
                        <div>
                          <p className="font-mono font-semibold text-foreground">
                            {tx.type === "deposit" ? "+" : "-"}{tx.amountFormatted} {tx.coinSymbol}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono border ${
                        tx.status === 'confirmed' 
                          ? 'bg-success/20 text-success border-success/30' 
                          : tx.status === 'pending'
                          ? 'bg-warning/20 text-warning border-warning/30'
                          : 'bg-destructive/20 text-destructive border-destructive/30'
                      }`}>
                        {tx.status === 'confirmed' ? '✓' : tx.status === 'pending' ? '⏳' : '✗'} {tx.status.toUpperCase()}
                      </span>
                      <a 
                        href={`https://explorer.aptoslabs.com/txn/${tx.transactionHash}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        {tx.transactionHash.slice(0, 8)}...{tx.transactionHash.slice(-6)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">No Transactions Yet</h3>
                  <p className="text-muted-foreground">
                    Your vault transaction history will appear here once you make your first deposit or withdrawal.
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

export default Vault;