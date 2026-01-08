import { useState, useEffect, useCallback } from 'react';
import { apiService, MarketData, ArbitrageOpportunity } from '@/services/ApiService';

export interface TokenPrice {
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  volume24h?: string;
  marketCap?: string;
}

export interface UseMarketDataReturn {
  marketData: MarketData | null;
  tokenPrices: Record<string, TokenPrice>;
  opportunities: ArbitrageOpportunity[];
  isLoading: boolean;
  error: string | null;
  refreshMarketData: () => Promise<void>;
  refreshOpportunities: () => Promise<void>;
  checkProfitability: (fromToken: string, toToken: string, amount: number) => Promise<ArbitrageOpportunity | null>;
}

export const useMarketData = (): UseMarketDataReturn => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, TokenPrice>>({});
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh market data
  const refreshMarketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.getMarketOverview();
      
      if (response.success && response.data) {
        setMarketData(response.data);
        
        // Transform market data to token prices
        const prices: Record<string, TokenPrice> = {};
        
        response.data.chains.forEach(chain => {
          const symbol = chain.chain.toUpperCase();
          const price = parseFloat(chain.current_price);
          
          prices[symbol] = {
            symbol,
            price: `$${price.toFixed(price < 1 ? 4 : 2)}`,
            change: '+0.0%', // API doesn't provide 24h change
            isPositive: true,
            volume24h: chain.volume_24h,
            marketCap: chain.market_cap
          };
        });
        
        setTokenPrices(prices);
      } else {
        setError(response.error || 'Failed to load market data');
      }
    } catch (err) {
      console.error('Market data error:', err);
      setError('Failed to refresh market data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh arbitrage opportunities
  const refreshOpportunities = useCallback(async () => {
    try {
      const response = await apiService.findArbitrageOpportunities({
        trade_amount: 1000, // Default $1000 trade amount
        dex_fees: {
          "Smart Contract": 0.30 // Default 0.3% fee
        }
      });
      
      if (response.success && response.data?.opportunities?.top_opportunities) {
        setOpportunities(response.data.opportunities.top_opportunities);
      }
    } catch (err) {
      console.error('Opportunities error:', err);
    }
  }, []);

  // Check profitability for specific trade
  const checkProfitability = useCallback(async (
    fromToken: string, 
    toToken: string, 
    amount: number
  ): Promise<ArbitrageOpportunity | null> => {
    try {
      const response = await apiService.checkProfitability({
        from_token: fromToken.toLowerCase(),
        to_token: toToken.toLowerCase(),
        trade_amount: amount,
        dex_fees: {
          "Smart Contract": 0.30
        }
      });
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return null;
    } catch (err) {
      console.error('Profitability check error:', err);
      return null;
    }
  }, []);

  // Load data on mount and set up refresh interval
  useEffect(() => {
    refreshMarketData();
    refreshOpportunities();

    // Refresh market data every 30 seconds
    const marketInterval = setInterval(refreshMarketData, 30000);
    
    // Refresh opportunities every 60 seconds
    const opportunitiesInterval = setInterval(refreshOpportunities, 60000);

    return () => {
      clearInterval(marketInterval);
      clearInterval(opportunitiesInterval);
    };
  }, [refreshMarketData, refreshOpportunities]);

  return {
    marketData,
    tokenPrices,
    opportunities,
    isLoading,
    error,
    refreshMarketData,
    refreshOpportunities,
    checkProfitability
  };
};