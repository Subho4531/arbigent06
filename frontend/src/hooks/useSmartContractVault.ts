import { useState, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { smartContractService, TransactionResult } from '@/services/SmartContractService';
import { apiService } from '@/services/ApiService';
import { balanceService } from '@/services/BalanceService';
import { Account, Ed25519PrivateKey, Aptos, AptosConfig, Network, InputTransactionData } from '@aptos-labs/ts-sdk';

// Smart contract configuration
const CONTRACT_ADDRESS = '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9';
const MODULE_NAME = 'swap';

// Extend window type for Petra wallet
declare global {
  interface Window {
    aptos?: {
      signAndSubmitTransaction: (transaction: InputTransactionData) => Promise<{ hash: string }>;
    };
  }
}

export interface UseSmartContractVaultReturn {
  isProcessing: boolean;
  error: string | null;
  
  // Vault operations with smart contract integration
  depositAPTtoVault: (amount: string, targetToken: 'USDC' | 'USDT') => Promise<boolean>;
  depositTokenToVault: (amount: string, token: 'USDC' | 'USDT') => Promise<boolean>;
  withdrawFromVault: (amount: string, sourceToken: 'USDC' | 'USDT') => Promise<boolean>;
  
  // Token minting for testing
  mintTestTokens: (token: 'USDC' | 'USDT', amount: string) => Promise<boolean>;
  
  // Cross-token swaps
  swapTokens: (fromToken: 'USDC' | 'USDT', toToken: 'USDC' | 'USDT', amount: string) => Promise<boolean>;
  
  // Arbitrage operations
  executeArbitrage: (inputAmount: string, tokenPair: string) => Promise<boolean>;
  
  clearError: () => void;
}

export const useSmartContractVault = (): UseSmartContractVaultReturn => {
  const { account, connected } = useWallet();
  const { signAndSubmitTransaction } = useAptosWallet(); // Get the signing function from wallet adapter
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to create Account object from wallet
  const getAccountFromWallet = useCallback((): Account | null => {
    if (!account?.address || !account?.publicKey) return null;
    
    try {
      // For Petra wallet, we don't need to create an Account object
      // The wallet will handle signing through the wallet adapter
      return null; // Wallet adapter will handle signing
    } catch (err) {
      console.error('Error creating account:', err);
      return null;
    }
  }, [account]);

  // Helper to sign and submit transaction through wallet adapter
  const submitTransaction = useCallback(async (transaction: InputTransactionData) => {
    if (!account?.address || !signAndSubmitTransaction) {
      throw new Error('Wallet not connected or signing not available');
    }

    try {
      console.log('Submitting transaction:', transaction);
      
      // Use the wallet adapter's signAndSubmitTransaction method
      const response = await signAndSubmitTransaction(transaction);
      
      console.log('Transaction response:', response);
      
      if (response?.hash) {
        // Wait for transaction confirmation
        const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
        console.log('Waiting for transaction confirmation:', response.hash);
        
        await aptos.waitForTransaction({ transactionHash: response.hash });
        console.log('Transaction confirmed:', response.hash);
        
        return { success: true, hash: response.hash };
      } else {
        throw new Error('Transaction failed - no hash returned');
      }
    } catch (err) {
      console.error('Transaction signing error:', err);
      throw err;
    }
  }, [account, signAndSubmitTransaction]);

  // Helper to create batch transaction for APT deposit
  const createBatchTransaction = useCallback(async (
    aptAmount: string,
    targetToken: 'USDC' | 'USDT'
  ) => {
    const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
    
    // Create a multi-sig transaction with both operations
    const transaction = await aptos.transaction.build.multiAgent({
      sender: account!.address,
      data: {
        function: '0x1::aptos_account::batch_transfer',
        functionArguments: [
          // First: Transfer APT to contract
          [CONTRACT_ADDRESS],
          [aptAmount]
        ],
      },
      secondarySigners: []
    });

    return transaction;
  }, [account]);

  // Deposit USDC/USDT directly to vault (burns from wallet)
  const depositTokenToVault = useCallback(async (
    amount: string,
    token: 'USDC' | 'USDT'
  ): Promise<boolean> => {
    if (!connected || !account?.address) {
      setError('Wallet not connected');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert amount to smallest unit (USDC/USDT have 6 decimals)
      const tokenAmount = (parseFloat(amount) * Math.pow(10, 6)).toString();
      
      console.log(`🔥 Depositing ${token} to vault:`, { amount, tokenAmount });

      // Use the new vault deposit functions that properly burn tokens
      const transaction: InputTransactionData = {
        data: {
          function: token === 'USDC'
            ? `${CONTRACT_ADDRESS}::${MODULE_NAME}::deposit_usdc_to_vault`
            : `${CONTRACT_ADDRESS}::${MODULE_NAME}::deposit_usdt_to_vault`,
          functionArguments: [tokenAmount],
        },
      };

      console.log(`📝 Submitting ${token} vault deposit transaction:`, transaction);

      const result = await submitTransaction(transaction);

      if (result.success && result.hash) {
        console.log(`✅ ${token} vault deposit successful:`, result.hash);

        // Update vault balance in backend
        await apiService.depositToVault(
          account.address,
          token,
          tokenAmount,
          result.hash
        );

        console.log(`✅ ${token} vault balance updated in backend`);
        return true;
      } else {
        setError(`${token} vault deposit transaction failed`);
        return false;
      }
    } catch (err) {
      console.error(`❌ ${token} vault deposit error:`, err);
      setError(err instanceof Error ? err.message : `${token} vault deposit failed`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [connected, account, submitTransaction]);

  // Deposit APT to vault (converts APT to USDC/USDT via smart contract)
  const depositAPTtoVault = useCallback(async (
    amount: string, 
    targetToken: 'USDC' | 'USDT'
  ): Promise<boolean> => {
    if (!connected || !account?.address) {
      setError('Wallet not connected');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert amount to smallest unit (APT has 8 decimals)
      const aptAmount = (parseFloat(amount) * Math.pow(10, 8)).toString();
      
      console.log('🔥 Depositing APT to vault:', { amount, aptAmount, targetToken });

      // Call smart contract to swap APT to USDC/USDT
      // This should consume APT from wallet and mint USDC/USDT
      const transaction: InputTransactionData = {
        data: {
          function: targetToken === 'USDC' 
            ? `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_apt_to_usdc`
            : `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_apt_to_usdt`,
          functionArguments: [aptAmount],
        },
      };

      console.log('📝 Submitting swap transaction:', transaction);

      const result = await submitTransaction(transaction);

      if (result.success && result.hash) {
        console.log('✅ Smart contract swap successful:', result.hash);

        // Calculate expected output amount
        const targetAmount = await calculateSwapOutput(aptAmount, 'APT', targetToken);
        
        console.log('💰 Expected vault increase:', targetAmount, targetToken);

        // Update vault balance in backend
        await apiService.depositToVault(
          account.address,
          targetToken,
          targetAmount,
          result.hash
        );

        console.log('✅ Vault balance updated in backend');
        return true;
      } else {
        setError('Smart contract transaction failed');
        return false;
      }
    } catch (err) {
      console.error('❌ APT deposit error:', err);
      setError(err instanceof Error ? err.message : 'APT deposit failed');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [connected, account, submitTransaction]);

  // Withdraw from vault (burns USDC/USDT and converts to APT)
  const withdrawFromVault = useCallback(async (
    amount: string, 
    sourceToken: 'USDC' | 'USDT'
  ): Promise<boolean> => {
    if (!connected || !account?.address) {
      setError('Wallet not connected');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert amount to smallest unit (USDC/USDT have 6 decimals)
      const tokenAmount = (parseFloat(amount) * Math.pow(10, 6)).toString();
      
      console.log(`🔥 Withdrawing ${sourceToken} from vault:`, { amount, tokenAmount });

      // Use the new vault withdrawal functions that properly mint tokens
      const transaction: InputTransactionData = {
        data: {
          function: sourceToken === 'USDC'
            ? `${CONTRACT_ADDRESS}::${MODULE_NAME}::withdraw_usdc_from_vault`
            : `${CONTRACT_ADDRESS}::${MODULE_NAME}::withdraw_usdt_from_vault`,
          functionArguments: [tokenAmount],
        },
      };

      console.log(`📝 Submitting ${sourceToken} vault withdrawal transaction:`, transaction);

      // Sign and submit through wallet
      const result = await submitTransaction(transaction);

      if (result.success && result.hash) {
        console.log(`✅ ${sourceToken} vault withdrawal successful:`, result.hash);

        // Update vault balance in backend
        await apiService.withdrawFromVault(
          account.address,
          sourceToken,
          tokenAmount,
          result.hash
        );

        console.log(`✅ ${sourceToken} vault balance updated in backend`);
        return true;
      } else {
        setError(`${sourceToken} vault withdrawal transaction failed`);
        return false;
      }
    } catch (err) {
      console.error(`❌ ${sourceToken} vault withdrawal error:`, err);
      setError(err instanceof Error ? err.message : `${sourceToken} vault withdrawal failed`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [connected, account, submitTransaction]);

  // Mint test tokens (for testing purposes)
  const mintTestTokens = useCallback(async (
    token: 'USDC' | 'USDT', 
    amount: string
  ): Promise<boolean> => {
    if (!connected || !account?.address) {
      setError('Wallet not connected');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert amount to smallest unit
      const tokenAmount = (parseFloat(amount) * Math.pow(10, 6)).toString();
      
      // Create transaction data
      const transaction: InputTransactionData = {
        data: {
          function: token === 'USDC'
            ? `${CONTRACT_ADDRESS}::${MODULE_NAME}::mint_usdc`
            : `${CONTRACT_ADDRESS}::${MODULE_NAME}::mint_usdt`,
          functionArguments: [tokenAmount],
        },
      };

      // Sign and submit through wallet
      const result = await submitTransaction(transaction);

      if (result.success) {
        // Refresh balances after minting
        await balanceService.refreshBalances(account.address);
        return true;
      } else {
        setError('Minting failed');
        return false;
      }
    } catch (err) {
      console.error('Mint error:', err);
      setError(err instanceof Error ? err.message : 'Minting failed');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [connected, account, submitTransaction]);

  // Swap between USDC and USDT
  const swapTokens = useCallback(async (
    fromToken: 'USDC' | 'USDT', 
    toToken: 'USDC' | 'USDT', 
    amount: string
  ): Promise<boolean> => {
    if (!connected || !account?.address || fromToken === toToken) {
      setError('Invalid swap parameters');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const tokenAmount = (parseFloat(amount) * Math.pow(10, 6)).toString();
      
      // Create transaction data
      const transaction: InputTransactionData = {
        data: {
          function: fromToken === 'USDC' && toToken === 'USDT'
            ? `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_usdc_to_usdt`
            : `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_usdt_to_usdc`,
          functionArguments: [tokenAmount],
        },
      };

      // Sign and submit through wallet
      const result = await submitTransaction(transaction);

      if (result.success) {
        // Refresh balances after swap
        await balanceService.refreshBalances(account.address);
        return true;
      } else {
        setError('Swap failed');
        return false;
      }
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Swap failed');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [connected, account, submitTransaction]);

  // Execute arbitrage
  const executeArbitrage = useCallback(async (
    inputAmount: string, 
    tokenPair: string
  ): Promise<boolean> => {
    if (!connected || !account?.address) {
      setError('Wallet not connected');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check profitability first
      const profitCheck = await smartContractService.checkProfitability(inputAmount);
      
      if (!profitCheck?.profitable) {
        setError('Arbitrage not profitable');
        return false;
      }

      const expectedOutput = (parseFloat(inputAmount) + parseFloat(profitCheck.profit)).toString();
      
      const result = await smartContractService.executeArbitrage(
        getAccountFromWallet()!,
        inputAmount,
        expectedOutput,
        tokenPair
      );

      if (result.success) {
        return true;
      } else {
        setError(result.error || 'Arbitrage execution failed');
        return false;
      }
    } catch (err) {
      console.error('Arbitrage error:', err);
      setError(err instanceof Error ? err.message : 'Arbitrage failed');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [connected, account]);

  // Helper function to calculate swap output based on smart contract rates
  const calculateSwapOutput = async (
    inputAmount: string, 
    fromToken: string, 
    toToken: string
  ): Promise<string> => {
    try {
      // inputAmount is already in smallest units
      const inputInSmallestUnits = BigInt(inputAmount);
      let outputInSmallestUnits = 0n;

      console.log(`🔢 Calculating swap: ${inputAmount} ${fromToken} → ${toToken}`);

      if (fromToken === 'APT' && toToken === 'USDC') {
        // APT to USDC: rate = 8000000 / 100000000 = 0.08 USDC per APT
        // Input is in APT smallest units (8 decimals), output should be in USDC smallest units (6 decimals)
        outputInSmallestUnits = (inputInSmallestUnits * 8000000n) / 100000000n;
      } else if (fromToken === 'APT' && toToken === 'USDT') {
        // APT to USDT: rate = 8050000 / 100000000 = 0.08050 USDT per APT
        outputInSmallestUnits = (inputInSmallestUnits * 8050000n) / 100000000n;
      } else if (fromToken === 'USDC' && toToken === 'APT') {
        // USDC to APT: rate = 12500000 / 1000000 = 12.5 APT per USDC
        // Input is in USDC smallest units (6 decimals), output should be in APT smallest units (8 decimals)
        outputInSmallestUnits = (inputInSmallestUnits * 12500000n) / 1000000n;
      } else if (fromToken === 'USDT' && toToken === 'APT') {
        // USDT to APT: rate = 12400000 / 1000000 = 12.4 APT per USDT
        outputInSmallestUnits = (inputInSmallestUnits * 12400000n) / 1000000n;
      } else if (fromToken === 'USDC' && toToken === 'USDT') {
        // USDC to USDT: rate = 9995 / 10000 = 0.9995
        outputInSmallestUnits = (inputInSmallestUnits * 9995n) / 10000n;
      } else if (fromToken === 'USDT' && toToken === 'USDC') {
        // USDT to USDC: rate = 9995 / 10000 = 0.9995
        outputInSmallestUnits = (inputInSmallestUnits * 9995n) / 10000n;
      }

      const result = outputInSmallestUnits.toString();
      console.log(`🔢 Swap calculation result: ${result} (${fromToken} → ${toToken})`);
      
      return result;
    } catch (err) {
      console.error('Calculate swap output error:', err);
      return '0';
    }
  };

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isProcessing,
    error,
    depositAPTtoVault,
    depositTokenToVault,
    withdrawFromVault,
    mintTestTokens,
    swapTokens,
    executeArbitrage,
    clearError
  };
};