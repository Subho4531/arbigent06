import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import { 
  NetworkConfig, 
  NetworkValidator, 
  NetworkSwitcher, 
  DEFAULT_NETWORK,
  APTOS_TESTNET_CONFIG 
} from '@/config/network';
import { balanceService, TokenBalances } from '@/services/BalanceService';
import { 
  formatError, 
  FormattedError, 
  withLoadingAndError,
  globalLoadingManager 
} from '@/utils/errorHandling';

// Token balance interface (re-export from service)
interface TokenBalances {
  APT: string;
  USDC: string;
  USDT: string;
}

// Wallet information interface
interface WalletInfo {
  name: string;
  icon: string;
  url: string;
}

// Main wallet context type interface
interface WalletContextType {
  // Connection state
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  
  // Account information
  account: {
    address: string;
    publicKey: string | string[];
    ansName?: string | null;
  } | null;
  
  // Network information
  network: NetworkConfig | null;
  
  // Network validation and switching
  isCorrectNetwork: boolean;
  switchToTestnet: () => Promise<boolean>;
  getNetworkSwitchPrompt: () => string;
  
  // Wallet information
  wallet: WalletInfo | null;
  
  // Available wallets
  wallets: WalletInfo[];
  
  // Connection methods
  connect: (walletName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Wallet detection
  detectWallet: (walletName: string) => boolean;
  
  // Balance information
  balances: TokenBalances;
  
  // Balance operations
  fetchBalances: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  
  // Error handling
  error: string | null;
  formattedError: FormattedError | null;
  clearError: () => void;
}

// Create the context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Provider props interface
interface WalletProviderProps {
  children: ReactNode;
}

// Wallet provider component
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  // Use the Aptos wallet adapter
  const {
    connect: aptosConnect,
    disconnect: aptosDisconnect,
    account: aptosAccount,
    connected: aptosConnected,
    connecting: aptosConnecting,
    disconnecting: aptosDisconnecting,
    wallet: aptosWallet,
    wallets: aptosWallets,
    network: aptosNetwork
  } = useAptosWallet();

  // Local state for balances and errors
  const [balances, setBalances] = useState<TokenBalances>({
    APT: '0',
    USDC: '0',
    USDT: '0'
  });
  
  const [balancesLoading, setBalancesLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formattedError, setFormattedError] = useState<FormattedError | null>(null);

  // Convert Aptos wallet adapter data to our interface format
  const account = aptosAccount ? {
    address: aptosAccount.address.toString(),
    publicKey: Array.isArray(aptosAccount.publicKey) 
      ? aptosAccount.publicKey.map(pk => pk.toString())
      : aptosAccount.publicKey.toString(),
    ansName: aptosAccount.ansName || null
  } : null;

  const network: NetworkConfig | null = aptosNetwork ? {
    name: aptosNetwork.name as 'testnet' | 'mainnet' | 'devnet',
    chainId: aptosNetwork.chainId?.toString() || '',
    rpcUrl: aptosNetwork.url || '',
    displayName: NetworkValidator.getNetworkDisplayName(aptosNetwork.name)
  } : null;

  const wallet: WalletInfo | null = aptosWallet ? {
    name: aptosWallet.name,
    icon: aptosWallet.icon,
    url: aptosWallet.url
  } : null;

  const wallets: WalletInfo[] = aptosWallets.map(w => ({
    name: w.name,
    icon: w.icon,
    url: w.url
  }));

  // Network validation
  const isCorrectNetwork = network ? NetworkValidator.isConnectedToTestnet(aptosNetwork) : false;

  // Network switching methods with enhanced error handling
  const switchToTestnet = async (): Promise<boolean> => {
    const result = await withLoadingAndError(
      'network-switch',
      async () => {
        if (!aptosConnected) {
          throw new Error('Wallet must be connected to switch networks');
        }

        const success = await NetworkSwitcher.switchToNetwork(APTOS_TESTNET_CONFIG);
        
        if (!success) {
          const promptMessage = NetworkSwitcher.getNetworkSwitchPrompt(APTOS_TESTNET_CONFIG);
          throw new Error(promptMessage);
        }
        
        return success;
      },
      handleError
    );
    
    return result || false;
  };

  const getNetworkSwitchPrompt = (): string => {
    return NetworkSwitcher.getNetworkSwitchPrompt(APTOS_TESTNET_CONFIG);
  };

  // Wallet detection helper
  const detectWallet = (walletName: string): boolean => {
    if (walletName === 'Petra') {
      // Check if Petra wallet is installed by looking for window.aptos
      return typeof window !== 'undefined' && 'aptos' in window;
    }
    
    // For other wallets, check if they exist in the available wallets list
    return aptosWallets.some(w => w.name === walletName);
  };

  // Connection methods with enhanced error handling
  const connect = async (walletName: string) => {
    await withLoadingAndError(
      'wallet-connect',
      async () => {
        // First, detect if the wallet is available
        if (!detectWallet(walletName)) {
          throw new Error(`${walletName} wallet is not installed. Please install it from the official website.`);
        }
        
        // Attempt to connect using the Aptos wallet adapter
        await aptosConnect(walletName);
        
        // Verify network is testnet (requirement 2.1, 2.2)
        // Wait a moment for network info to be available
        setTimeout(() => {
          if (aptosNetwork && !NetworkValidator.isConnectedToTestnet(aptosNetwork)) {
            const promptMessage = `Wrong network detected. ${NetworkSwitcher.getNetworkSwitchPrompt(APTOS_TESTNET_CONFIG)}`;
            handleError(new Error(promptMessage));
            console.warn('Wallet connected to wrong network. Expected testnet.');
          }
        }, 1000);
        
        // Store connection state in localStorage for persistence
        localStorage.setItem('wallet_connected', 'true');
        localStorage.setItem('wallet_name', walletName);
        localStorage.setItem('wallet_connection_time', new Date().toISOString());
        
        return true;
      },
      handleError
    );
  };

  const disconnect = async () => {
    await withLoadingAndError(
      'wallet-disconnect',
      async () => {
        // Disconnect using the Aptos wallet adapter
        await aptosDisconnect();
        
        // Comprehensive state cleanup
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('wallet_name');
        localStorage.removeItem('wallet_connection_time');
        
        // Clear all wallet-related state
        setBalances({
          APT: '0',
          USDC: '0',
          USDT: '0'
        });
        
        clearError();
        
        return true;
      },
      (error) => {
        // Even if disconnect fails, clear local state
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('wallet_name');
        localStorage.removeItem('wallet_connection_time');
        
        setBalances({
          APT: '0',
          USDC: '0',
          USDT: '0'
        });
        
        handleError(error);
      }
    );
  };

  // Balance fetching methods with enhanced error handling
  const fetchBalances = async () => {
    if (!account?.address) {
      return;
    }

    await withLoadingAndError(
      'balance-fetch',
      async () => {
        console.log('Fetching balances for address:', account.address);
        
        // Use the balance service to fetch real balances
        const fetchedBalances = await balanceService.fetchAllBalances(account.address);
        
        setBalances(fetchedBalances);
        return fetchedBalances;
      },
      handleError
    );
  };

  const refreshBalances = async () => {
    if (!account?.address) {
      return;
    }

    await withLoadingAndError(
      'balance-refresh',
      async () => {
        console.log('Refreshing balances for address:', account.address);
        
        // Use the balance service to refresh balances (clears cache)
        const refreshedBalances = await balanceService.refreshBalances(account.address);
        
        setBalances(refreshedBalances);
        return refreshedBalances;
      },
      handleError
    );
  };

  // Enhanced error handling helper
  const handleError = (err: Error | string) => {
    const errorMessage = err instanceof Error ? err.message : err;
    const formatted = formatError(err);
    
    setError(errorMessage);
    setFormattedError(formatted);
    
    console.error('Wallet error:', formatted);
  };

  // Clear error helper
  const clearError = () => {
    setError(null);
    setFormattedError(null);
  };

  // Effect to fetch balances when account changes
  useEffect(() => {
    if (aptosConnected && account?.address) {
      fetchBalances();
    }
  }, [aptosConnected, account?.address]);

  // Effect to restore connection state on page load with enhanced logic
  useEffect(() => {
    const wasConnected = localStorage.getItem('wallet_connected');
    const walletName = localStorage.getItem('wallet_name');
    const connectionTime = localStorage.getItem('wallet_connection_time');
    
    // Only attempt reconnection if we have valid stored state
    if (wasConnected === 'true' && walletName && !aptosConnected && !aptosConnecting) {
      // Check if connection is not too old (optional: expire after 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const isConnectionFresh = connectionTime && 
        (Date.now() - new Date(connectionTime).getTime()) < maxAge;
      
      if (isConnectionFresh || !connectionTime) {
        // Attempt to reconnect
        connect(walletName).catch((error) => {
          console.warn('Failed to restore wallet connection:', error.message);
          
          // If reconnection fails, clear stored state
          localStorage.removeItem('wallet_connected');
          localStorage.removeItem('wallet_name');
          localStorage.removeItem('wallet_connection_time');
        });
      } else {
        // Connection is too old, clear it
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('wallet_name');
        localStorage.removeItem('wallet_connection_time');
      }
    }
  }, []);

  // Check loading states from global loading manager
  const isConnecting = globalLoadingManager.isLoading('wallet-connect') || aptosConnecting;
  const isDisconnecting = globalLoadingManager.isLoading('wallet-disconnect') || aptosDisconnecting;
  const isBalancesLoading = globalLoadingManager.isLoading('balance-fetch') || globalLoadingManager.isLoading('balance-refresh');

  const contextValue: WalletContextType = {
    // Connection state
    connected: aptosConnected,
    connecting: isConnecting,
    disconnecting: isDisconnecting,
    
    // Account information
    account,
    
    // Network information
    network,
    
    // Network validation and switching
    isCorrectNetwork,
    switchToTestnet,
    getNetworkSwitchPrompt,
    
    // Wallet information
    wallet,
    wallets,
    
    // Connection methods
    connect,
    disconnect,
    
    // Wallet detection
    detectWallet,
    
    // Balance information
    balances,
    
    // Balance operations
    fetchBalances,
    refreshBalances,
    
    // Error handling
    error,
    formattedError,
    clearError
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook for accessing wallet context
export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

// Export types for use in other components
export type { WalletContextType, TokenBalances, NetworkConfig, WalletInfo, FormattedError };