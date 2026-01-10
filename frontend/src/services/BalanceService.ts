import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Smart contract address
const CONTRACT_ADDRESS = '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9';

// Token balance interface
export interface TokenBalances {
  APT: string;
  USDC: string;
  USDT: string;
}

// Token configuration interface
export interface TokenConfig {
  symbol: 'APT' | 'USDC' | 'USDT';
  name: string;
  decimals: number;
  contractAddress?: string; // For non-native tokens
  coinType: string; // Aptos coin type identifier
}

// Token configurations for Aptos testnet
export const TOKEN_CONFIGS: Record<string, TokenConfig> = {
  APT: {
    symbol: 'APT',
    name: 'Aptos Token',
    decimals: 8,
    coinType: '0x1::aptos_coin::AptosCoin'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coinType: '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9::swap::USDC'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    coinType: '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9::swap::USDT'
  }
};

// Common USDC token types on Aptos testnet
export const COMMON_USDC_TYPES = [
  '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9::swap::USDC', // Our contract USDC
  '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC', // LayerZero USDC
  '0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T', // Wormhole USDC
  '0x43417434fd869edee76cca2a4d2301e528a1551b1d719b75c350c3c97d15b8b9::coins::USDC', // Another common USDC
];

// Common USDT token types on Aptos testnet  
export const COMMON_USDT_TYPES = [
  '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9::swap::USDT', // Our contract USDT
  '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT', // LayerZero USDT
  '0xa2eda21a58856fda86451436513b867c97eecb4ba099da5775520e0f7492e852::coin::T', // Wormhole USDT
  '0x43417434fd869edee76cca2a4d2301e528a1551b1d719b75c350c3c97d15b8b9::coins::USDT', // Another common USDT
];

// Balance service class
export class BalanceService {
  private aptos: Aptos;
  private cache: Map<string, { balance: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  constructor(network: Network = Network.TESTNET) {
    const config = new AptosConfig({ network });
    this.aptos = new Aptos(config);
  }

  /**
   * Fetch APT balance for a given address
   */
  async fetchAPTBalance(address: string): Promise<string> {
    try {
      const cacheKey = `${address}-APT`;
      const cached = this.getCachedBalance(cacheKey);
      if (cached) return cached;

      const balance = await this.aptos.getAccountAPTAmount({
        accountAddress: address
      });

      const formattedBalance = this.formatBalance(balance.toString(), TOKEN_CONFIGS.APT.decimals);
      this.setCachedBalance(cacheKey, formattedBalance);
      
      return formattedBalance;
    } catch (error) {
      console.error('Failed to fetch APT balance:', error);
      throw new Error(`Failed to fetch APT balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch USDC balance using Fungible Asset API (correct method)
   */
  async fetchUSDCBalance(address: string): Promise<string> {
    try {
      const cacheKey = `${address}-USDC`;
      const cached = this.getCachedBalance(cacheKey);
      if (cached) return cached;


      // Use the correct USDC coin type from our contract
      const usdcCoinType = `${CONTRACT_ADDRESS}::swap::USDC`;
      

      try {
        const usdcAssets = await this.aptos.getCurrentFungibleAssetBalances({
          options: {
            where: {
              owner_address: { _eq: address },
              asset_type: { _eq: usdcCoinType }
            }
          }
        });


        if (usdcAssets && usdcAssets.length > 0) {
          const rawBalance = usdcAssets[0].amount;
          const formattedBalance = this.formatBalance(rawBalance, TOKEN_CONFIGS.USDC.decimals);
          
          
          this.setCachedBalance(cacheKey, formattedBalance);
          return formattedBalance;
        } else {
          this.setCachedBalance(cacheKey, '0');
          return '0';
        }
      } catch (assetError) {
        
        // Check for external USDC tokens
        const externalUSDC = await this.checkExternalUSDC(address);
        
        if (externalUSDC !== '0') {
          this.setCachedBalance(cacheKey, externalUSDC);
          return externalUSDC;
        }
        
        // Fallback to checking common USDC types using Coin API
        let totalBalance = 0n;
        
        for (const coinType of COMMON_USDC_TYPES) {
          try {
            const balance = await this.fetchTokenBalance(address, coinType);
            if (balance !== '0') {
              totalBalance += BigInt(balance);
            }
          } catch (error) {
            // Continue to next token type if this one fails
            continue;
          }
        }

        const formattedBalance = this.formatBalance(totalBalance.toString(), TOKEN_CONFIGS.USDC.decimals);
        this.setCachedBalance(cacheKey, formattedBalance);
        return formattedBalance;
      }
    } catch (error) {
      console.error('❌ Failed to fetch USDC balance:', error);
      return '0';
    }
  }

  /**
   * Check for external USDC tokens (from other sources like exchanges, bridges, etc.)
   */
  async checkExternalUSDC(address: string): Promise<string> {
    
    try {
      // Get all fungible asset balances for the address
      const allAssets = await this.aptos.getCurrentFungibleAssetBalances({
        options: {
          where: {
            owner_address: { _eq: address }
          }
        }
      });


      // Look for any asset that might be USDC
      const usdcAssets = allAssets.filter((asset: any) => {
        const assetType = asset.asset_type?.toLowerCase() || '';
        return assetType.includes('usdc') || 
               assetType.includes('usd_coin') ||
               assetType.includes('usd coin');
      });


      if (usdcAssets.length > 0) {
        let totalBalance = 0n;
        
        for (const asset of usdcAssets) {
          const balance = BigInt(asset.amount || '0');
          totalBalance += balance;
        }

        // Assume 6 decimals for USDC (standard)
        const formattedBalance = this.formatBalance(totalBalance.toString(), 6);
        return formattedBalance;
      }

      return '0';
    } catch (error) {
      console.error('❌ Error checking external USDC:', error);
      return '0';
    }
  }
  async fetchUSDTBalance(address: string): Promise<string> {
    try {
      const cacheKey = `${address}-USDT`;
      const cached = this.getCachedBalance(cacheKey);
      if (cached) return cached;


      // Use the correct USDT coin type from our contract
      const usdtCoinType = `${CONTRACT_ADDRESS}::swap::USDT`;
      

      try {
        const usdtAssets = await this.aptos.getCurrentFungibleAssetBalances({
          options: {
            where: {
              owner_address: { _eq: address },
              asset_type: { _eq: usdtCoinType }
            }
          }
        });


        if (usdtAssets && usdtAssets.length > 0) {
          const rawBalance = usdtAssets[0].amount;
          const formattedBalance = this.formatBalance(rawBalance, TOKEN_CONFIGS.USDT.decimals);
          
          
          this.setCachedBalance(cacheKey, formattedBalance);
          return formattedBalance;
        } else {
          this.setCachedBalance(cacheKey, '0');
          return '0';
        }
      } catch (assetError) {
        console.error('❌ Fungible Asset API error:', assetError);
        
        // Fallback to checking common USDT types using Coin API
        let totalBalance = 0n;
        
        for (const coinType of COMMON_USDT_TYPES) {
          try {
            const balance = await this.fetchTokenBalance(address, coinType);
            if (balance !== '0') {
              totalBalance += BigInt(balance);
            }
          } catch (error) {
            // Continue to next token type if this one fails
            continue;
          }
        }

        const formattedBalance = this.formatBalance(totalBalance.toString(), TOKEN_CONFIGS.USDT.decimals);
        this.setCachedBalance(cacheKey, formattedBalance);
        return formattedBalance;
      }
    } catch (error) {
      console.error('❌ Failed to fetch USDT balance:', error);
      return '0';
    }
  }

  /**
   * Fetch all token balances for a given address
   */
  async fetchAllBalances(address: string): Promise<TokenBalances> {
    try {
      const [aptBalance, usdcBalance, usdtBalance] = await Promise.allSettled([
        this.fetchAPTBalance(address),
        this.fetchUSDCBalance(address),
        this.fetchUSDTBalance(address)
      ]);

      return {
        APT: aptBalance.status === 'fulfilled' ? aptBalance.value : '0',
        USDC: usdcBalance.status === 'fulfilled' ? usdcBalance.value : '0',
        USDT: usdtBalance.status === 'fulfilled' ? usdtBalance.value : '0'
      };
    } catch (error) {
      console.error('Failed to fetch all balances:', error);
      throw new Error(`Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh balances by clearing cache and fetching fresh data
   */
  async refreshBalances(address: string): Promise<TokenBalances> {
    // Clear cache for this address
    this.clearCacheForAddress(address);
    return this.fetchAllBalances(address);
  }

  /**
   * Generic method to fetch token balance by coin type
   */
  private async fetchTokenBalance(address: string, coinType: string): Promise<string> {
    try {
      const resource = await this.aptos.getAccountResource({
        accountAddress: address,
        resourceType: `0x1::coin::CoinStore<${coinType}>`
      });

      // Extract balance from the coin store resource
      const coinStore = resource as any;
      return coinStore.coin?.value || '0';
    } catch (error) {
      // If resource doesn't exist, balance is 0
      if (error instanceof Error && error.message.includes('Resource not found')) {
        return '0';
      }
      throw error;
    }
  }

  /**
   * Format balance from raw amount to human-readable format
   */
  private formatBalance(rawBalance: string, decimals: number): string {
    const balance = BigInt(rawBalance);
    const divisor = BigInt(10 ** decimals);
    
    const wholePart = balance / divisor;
    const fractionalPart = balance % divisor;
    
    if (fractionalPart === 0n) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    return trimmedFractional ? `${wholePart}.${trimmedFractional}` : wholePart.toString();
  }

  /**
   * Get cached balance if still valid
   */
  private getCachedBalance(key: string): string | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.balance;
    }
    return null;
  }

  /**
   * Set cached balance with timestamp
   */
  private setCachedBalance(key: string, balance: string): void {
    this.cache.set(key, {
      balance,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache for a specific address
   */
  private clearCacheForAddress(address: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(address));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cached balances
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export a default instance for testnet
export const balanceService = new BalanceService(Network.TESTNET);

// Export interface for dependency injection
export interface IBalanceService {
  fetchAPTBalance(address: string): Promise<string>;
  fetchUSDCBalance(address: string): Promise<string>;
  fetchUSDTBalance(address: string): Promise<string>;
  fetchAllBalances(address: string): Promise<TokenBalances>;
  refreshBalances(address: string): Promise<TokenBalances>;
  clearCache(): void;
}

export default BalanceService;