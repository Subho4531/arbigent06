import { Network } from '@aptos-labs/ts-sdk';

// Network configuration interface
export interface NetworkConfig {
  name: 'testnet' | 'mainnet' | 'devnet';
  chainId: string;
  rpcUrl: string;
  faucetUrl?: string;
  explorerUrl?: string;
  displayName: string;
}

// API configuration interface
export interface ApiConfig {
  backendUrl: string;
  arbitrageApiUrl: string;
  timeout: number;
}

// API configuration
export const API_CONFIG: ApiConfig = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api',
  arbitrageApiUrl: import.meta.env.VITE_ARBITRAGE_API_URL || 'https://market-observer-agentic.vercel.app',
  timeout: 30000 // 30 seconds
};

// Aptos testnet configuration
export const APTOS_TESTNET_CONFIG: NetworkConfig = {
  name: 'testnet',
  chainId: '2',
  rpcUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
  faucetUrl: 'https://faucet.testnet.aptoslabs.com',
  explorerUrl: 'https://explorer.aptoslabs.com/?network=testnet',
  displayName: 'Aptos Testnet'
};

// Aptos mainnet configuration
export const APTOS_MAINNET_CONFIG: NetworkConfig = {
  name: 'mainnet',
  chainId: '1',
  rpcUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
  explorerUrl: 'https://explorer.aptoslabs.com/?network=mainnet',
  displayName: 'Aptos Mainnet'
};

// Aptos devnet configuration
export const APTOS_DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  chainId: '3',
  rpcUrl: 'https://fullnode.devnet.aptoslabs.com/v1',
  faucetUrl: 'https://faucet.devnet.aptoslabs.com',
  explorerUrl: 'https://explorer.aptoslabs.com/?network=devnet',
  displayName: 'Aptos Devnet'
};

// Network configurations mapping
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  testnet: APTOS_TESTNET_CONFIG,
  mainnet: APTOS_MAINNET_CONFIG,
  devnet: APTOS_DEVNET_CONFIG
};

// Default network configuration
export const DEFAULT_NETWORK = APTOS_TESTNET_CONFIG;

// Network validation utilities
export class NetworkValidator {
  static isConnectedToTestnet(network: any): boolean {
    if (!network) return false;
    
    // Primary check: chain ID (most reliable)
    if (network.chainId !== undefined && network.chainId !== null) {
      return network.chainId === '2' || network.chainId === 2;
    }
    
    // Fallback: name check only if no chain ID
    return network.name === Network.TESTNET || network.name === 'testnet';
  }

  static isCorrectNetwork(currentNetwork: any, expectedConfig: NetworkConfig): boolean {
    if (!currentNetwork || !expectedConfig) return false;
    
    // Primary check: chain ID match
    if (currentNetwork.chainId && expectedConfig.chainId) {
      return currentNetwork.chainId.toString() === expectedConfig.chainId;
    }
    
    // Fallback: name match
    if (currentNetwork.name && expectedConfig.name) {
      return currentNetwork.name === expectedConfig.name;
    }
    
    return false;
  }

  static getNetworkDisplayName(networkName: string): string {
    const config = NETWORK_CONFIGS[networkName];
    if (config) {
      return config.displayName;
    }
    
    switch (networkName) {
      case 'testnet':
        return 'Aptos Testnet';
      case 'mainnet':
        return 'Aptos Mainnet';
      case 'devnet':
        return 'Aptos Devnet';
      default:
        return networkName;
    }
  }

  static getNetworkConfig(networkName: string): NetworkConfig | null {
    return NETWORK_CONFIGS[networkName] || null;
  }

  static isSupportedNetwork(networkName: string): boolean {
    return networkName in NETWORK_CONFIGS;
  }
}

// Network switching utilities
export class NetworkSwitcher {
  static async switchToNetwork(config: NetworkConfig): Promise<boolean> {
    if (typeof window === 'undefined' || !window.aptos) {
      return false; // Return false instead of throwing in test environment
    }

    try {
      // Request network change
      await window.aptos.changeNetwork({
        name: config.name,
        chainId: config.chainId,
        url: config.rpcUrl
      });
      return true;
    } catch (error) {
      console.error('Failed to switch network:', error);
      return false;
    }
  }

  static getNetworkSwitchPrompt(config: NetworkConfig): string {
    return `Please switch to ${config.displayName} in your Petra wallet. Go to Settings > Network and select ${config.displayName}.`;
  }
}

// Legacy exports for backward compatibility
export const validateNetwork = NetworkValidator.isConnectedToTestnet;
export const switchToTestnet = () => NetworkSwitcher.switchToNetwork(APTOS_TESTNET_CONFIG);
export const getNetworkStatusDisplay = (network: any) => {
  const isCorrect = NetworkValidator.isConnectedToTestnet(network);
  
  if (!network) {
    return {
      isCorrect: false,
      displayName: 'Unknown',
      message: 'Network information not available'
    };
  }

  if (isCorrect) {
    return {
      isCorrect: true,
      displayName: 'Aptos Testnet'
    };
  }

  return {
    isCorrect: false,
    displayName: network.name || 'Unknown Network',
    message: 'Please switch to Aptos Testnet'
  };
};

// Export default configuration
export default APTOS_TESTNET_CONFIG;