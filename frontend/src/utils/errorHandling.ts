// Error types for wallet operations
export enum WalletErrorType {
  WALLET_NOT_INSTALLED = 'WALLET_NOT_INSTALLED',
  USER_REJECTED = 'USER_REJECTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  BALANCE_FETCH_ERROR = 'BALANCE_FETCH_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Error messages mapping
export const ERROR_MESSAGES: Record<WalletErrorType, string> = {
  [WalletErrorType.WALLET_NOT_INSTALLED]: 'Petra wallet is not installed. Please install it from the Chrome Web Store.',
  [WalletErrorType.USER_REJECTED]: 'Connection was rejected by user. Please try again and approve the connection.',
  [WalletErrorType.NETWORK_ERROR]: 'Network connection error. Please check your internet connection and try again.',
  [WalletErrorType.NETWORK_MISMATCH]: 'Wrong network detected. Please switch to Aptos Testnet in your wallet.',
  [WalletErrorType.BALANCE_FETCH_ERROR]: 'Failed to fetch wallet balances. Please try refreshing.',
  [WalletErrorType.CONNECTION_FAILED]: 'Failed to connect to wallet. Please try again.',
  [WalletErrorType.TRANSACTION_FAILED]: 'Transaction failed. Please try again.',
  [WalletErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
};

// Recovery actions for different error types
export const RECOVERY_ACTIONS: Record<WalletErrorType, string[]> = {
  [WalletErrorType.WALLET_NOT_INSTALLED]: [
    'Install Petra wallet from the Chrome Web Store',
    'Refresh the page after installation',
    'Try connecting again'
  ],
  [WalletErrorType.USER_REJECTED]: [
    'Click "Connect Wallet" again',
    'Approve the connection in your wallet',
    'Make sure you trust this application'
  ],
  [WalletErrorType.NETWORK_ERROR]: [
    'Check your internet connection',
    'Try refreshing the page',
    'Wait a moment and try again'
  ],
  [WalletErrorType.NETWORK_MISMATCH]: [
    'Open your Petra wallet',
    'Go to Settings > Network',
    'Select "Aptos Testnet"',
    'Try connecting again'
  ],
  [WalletErrorType.BALANCE_FETCH_ERROR]: [
    'Click the refresh button',
    'Check your network connection',
    'Try disconnecting and reconnecting your wallet'
  ],
  [WalletErrorType.CONNECTION_FAILED]: [
    'Make sure Petra wallet is unlocked',
    'Try refreshing the page',
    'Check that the wallet extension is enabled'
  ],
  [WalletErrorType.TRANSACTION_FAILED]: [
    'Check your wallet balance',
    'Make sure you have enough APT for gas fees',
    'Try the transaction again'
  ],
  [WalletErrorType.UNKNOWN_ERROR]: [
    'Try refreshing the page',
    'Check browser console for more details',
    'Contact support if the problem persists'
  ]
};

// Error classification function
export function classifyError(error: Error | string): WalletErrorType {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('not installed') || lowerMessage.includes('wallet not found')) {
    return WalletErrorType.WALLET_NOT_INSTALLED;
  }
  
  if (lowerMessage.includes('user rejected') || lowerMessage.includes('user denied')) {
    return WalletErrorType.USER_REJECTED;
  }
  
  if (lowerMessage.includes('network') && (lowerMessage.includes('error') || lowerMessage.includes('failed'))) {
    return WalletErrorType.NETWORK_ERROR;
  }
  
  if (lowerMessage.includes('wrong network') || lowerMessage.includes('switch network')) {
    return WalletErrorType.NETWORK_MISMATCH;
  }
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('fetch')) {
    return WalletErrorType.BALANCE_FETCH_ERROR;
  }
  
  if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) {
    return WalletErrorType.CONNECTION_FAILED;
  }
  
  if (lowerMessage.includes('transaction')) {
    return WalletErrorType.TRANSACTION_FAILED;
  }
  
  return WalletErrorType.UNKNOWN_ERROR;
}

// Get user-friendly error message
export function getErrorMessage(error: Error | string): string {
  const errorType = classifyError(error);
  return ERROR_MESSAGES[errorType];
}

// Get recovery actions for an error
export function getRecoveryActions(error: Error | string): string[] {
  const errorType = classifyError(error);
  return RECOVERY_ACTIONS[errorType];
}

// Format error for display
export interface FormattedError {
  type: WalletErrorType;
  message: string;
  recoveryActions: string[];
  originalError?: string;
}

export function formatError(error: Error | string): FormattedError {
  const errorType = classifyError(error);
  const originalError = typeof error === 'string' ? error : error.message;
  
  return {
    type: errorType,
    message: ERROR_MESSAGES[errorType],
    recoveryActions: RECOVERY_ACTIONS[errorType],
    originalError
  };
}

// Retry mechanism with exponential backoff
export class RetryManager {
  private retryCount = 0;
  private maxRetries: number;
  private baseDelay: number;

  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      this.retryCount = 0; // Reset on success
      return result;
    } catch (error) {
      if (this.retryCount >= this.maxRetries) {
        throw error;
      }

      const delay = this.baseDelay * Math.pow(2, this.retryCount);
      this.retryCount++;

      console.warn(`Operation failed, retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.execute(operation);
    }
  }

  reset(): void {
    this.retryCount = 0;
  }

  get currentRetryCount(): number {
    return this.retryCount;
  }

  get hasRetriesLeft(): boolean {
    return this.retryCount < this.maxRetries;
  }
}

// Loading state manager
export class LoadingStateManager {
  private loadingStates: Map<string, boolean> = new Map();
  private listeners: Map<string, Set<(loading: boolean) => void>> = new Map();

  setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading);
    
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => listener(loading));
    }
  }

  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  subscribe(key: string, listener: (loading: boolean) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    this.listeners.get(key)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  clear(): void {
    this.loadingStates.clear();
    this.listeners.clear();
  }
}

// Global instances
export const globalRetryManager = new RetryManager();
export const globalLoadingManager = new LoadingStateManager();

// Utility function to handle async operations with loading and error states
export async function withLoadingAndError<T>(
  key: string,
  operation: () => Promise<T>,
  onError?: (error: FormattedError) => void
): Promise<T | null> {
  try {
    globalLoadingManager.setLoading(key, true);
    const result = await globalRetryManager.execute(operation);
    return result;
  } catch (error) {
    const formattedError = formatError(error as Error);
    
    if (onError) {
      onError(formattedError);
    }
    
    console.error(`Operation ${key} failed:`, formattedError);
    return null;
  } finally {
    globalLoadingManager.setLoading(key, false);
  }
}