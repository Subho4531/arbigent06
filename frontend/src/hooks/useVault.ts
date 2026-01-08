import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { apiService, Vault, VaultBalance, TransactionLog } from '@/services/ApiService';

export interface UseVaultReturn {
  vault: Vault | null;
  balances: VaultBalance[];
  transactions: TransactionLog[];
  isLoading: boolean;
  error: string | null;
  refreshVault: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  deposit: (coinSymbol: string, amount: string, transactionHash: string) => Promise<boolean>;
  withdraw: (coinSymbol: string, amount: string, transactionHash: string) => Promise<boolean>;
  getBalance: (coinSymbol: string) => string;
  getFormattedBalance: (coinSymbol: string) => string;
}

export const useVault = (): UseVaultReturn => {
  const { account } = useWallet();
  const [vault, setVault] = useState<Vault | null>(null);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get vault data
  const refreshVault = useCallback(async () => {
    if (!account?.address) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create user profile if needed
      await apiService.createUserProfile(
        account.address,
        account.publicKey?.toString() || '',
        account.ansName
      );

      // Get vault data
      const vaultResponse = await apiService.getUserVault(account.address);
      
      if (vaultResponse.success && vaultResponse.data) {
        setVault(vaultResponse.data);
      } else {
        setError(vaultResponse.error || 'Failed to load vault');
      }
    } catch (err) {
      console.error('Vault refresh error:', err);
      setError('Failed to refresh vault data');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  // Get transaction history
  const refreshTransactions = useCallback(async () => {
    if (!account?.address) return;

    try {
      const transactionsResponse = await apiService.getTransactionHistory(
        account.address,
        { limit: 20 }
      );
      
      if (transactionsResponse.success && transactionsResponse.data) {
        setTransactions(transactionsResponse.data);
      }
    } catch (err) {
      console.error('Transactions refresh error:', err);
    }
  }, [account]);

  // Deposit to vault
  const deposit = useCallback(async (
    coinSymbol: string, 
    amount: string, 
    transactionHash: string
  ): Promise<boolean> => {
    if (!account?.address) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.depositToVault(
        account.address,
        coinSymbol,
        amount,
        transactionHash
      );

      if (response.success && response.data) {
        setVault(response.data.vault);
        // Refresh transactions to show new deposit
        await refreshTransactions();
        return true;
      } else {
        setError(response.error || 'Deposit failed');
        return false;
      }
    } catch (err) {
      console.error('Deposit error:', err);
      setError('Deposit failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [account, refreshTransactions]);

  // Withdraw from vault
  const withdraw = useCallback(async (
    coinSymbol: string, 
    amount: string, 
    transactionHash: string
  ): Promise<boolean> => {
    if (!account?.address) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.withdrawFromVault(
        account.address,
        coinSymbol,
        amount,
        transactionHash
      );

      if (response.success && response.data) {
        setVault(response.data.vault);
        // Refresh transactions to show new withdrawal
        await refreshTransactions();
        return true;
      } else {
        setError(response.error || 'Withdrawal failed');
        return false;
      }
    } catch (err) {
      console.error('Withdraw error:', err);
      setError('Withdrawal failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [account, refreshTransactions]);

  // Get balance for specific coin
  const getBalance = useCallback((coinSymbol: string): string => {
    if (!vault) return '0';
    
    const balance = vault.balances.find(b => b.coinSymbol === coinSymbol.toUpperCase());
    return balance?.balance || '0';
  }, [vault]);

  // Get formatted balance for display (converts from smallest units)
  const getFormattedBalance = useCallback((coinSymbol: string): string => {
    const balance = getBalance(coinSymbol);
    const symbol = coinSymbol.toUpperCase();
    
    // Convert from smallest units to human readable
    let decimals = 8; // Default for APT
    if (symbol === 'USDC' || symbol === 'USDT') {
      decimals = 6;
    }
    
    const numBalance = parseFloat(balance) / Math.pow(10, decimals);
    
    if (numBalance === 0) return '0';
    if (numBalance < 0.01) return '<0.01';
    
    return numBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  }, [getBalance]);

  // Load vault data when wallet connects
  useEffect(() => {
    if (account?.address) {
      refreshVault();
      refreshTransactions();
    } else {
      setVault(null);
      setTransactions([]);
      setError(null);
    }
  }, [account?.address, refreshVault, refreshTransactions]);

  return {
    vault,
    balances: vault?.balances || [],
    transactions,
    isLoading,
    error,
    refreshVault,
    refreshTransactions,
    deposit,
    withdraw,
    getBalance,
    getFormattedBalance
  };
};