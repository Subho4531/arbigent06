import React, { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { Button } from '@/components/ui/button';
import { COMMON_USDC_TYPES, COMMON_USDT_TYPES } from '@/services/BalanceService';

const WalletDebug: React.FC = () => {
  const { account, connected } = useWallet();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkAllTokens = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
    const results: any = {
      address: account.address,
      usdc: {},
      usdt: {},
      resources: []
    };

    try {
      // Check all USDC types
      for (const coinType of COMMON_USDC_TYPES) {
        try {
          const resource = await aptos.getAccountResource({
            accountAddress: account.address,
            resourceType: `0x1::coin::CoinStore<${coinType}>`
          });
          const coinStore = resource as any;
          results.usdc[coinType] = {
            balance: coinStore.coin?.value || '0',
            exists: true
          };
        } catch (error) {
          results.usdc[coinType] = {
            balance: '0',
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      // Check all USDT types
      for (const coinType of COMMON_USDT_TYPES) {
        try {
          const resource = await aptos.getAccountResource({
            accountAddress: account.address,
            resourceType: `0x1::coin::CoinStore<${coinType}>`
          });
          const coinStore = resource as any;
          results.usdt[coinType] = {
            balance: coinStore.coin?.value || '0',
            exists: true
          };
        } catch (error) {
          results.usdt[coinType] = {
            balance: '0',
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      // Get all account resources to see what tokens exist
      try {
        const allResources = await aptos.getAccountResources({
          accountAddress: account.address
        });
        
        results.resources = allResources
          .filter((resource: any) => resource.type.includes('CoinStore'))
          .map((resource: any) => ({
            type: resource.type,
            balance: resource.data?.coin?.value || '0'
          }));

        // Also get all fungible assets
        const allAssets = await aptos.getCurrentFungibleAssetBalances({
          options: {
            where: {
              owner_address: { _eq: account.address }
            }
          }
        });

        results.fungibleAssets = allAssets.map((asset: any) => ({
          asset_type: asset.asset_type,
          amount: asset.amount,
          formatted: (parseFloat(asset.amount) / 1000000).toFixed(6) // Assume 6 decimals
        }));

        console.log('🔍 All fungible assets found:', allAssets);

      } catch (error) {
        results.resourcesError = error instanceof Error ? error.message : 'Unknown error';
      }

      setDebugInfo(results);
    } catch (error) {
      console.error('Debug check failed:', error);
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="p-4 border rounded-lg bg-muted">
        <p className="text-muted-foreground">Connect wallet to debug token balances</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Wallet Debug</h3>
        <Button 
          onClick={checkAllTokens} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? 'Checking...' : 'Check All Tokens'}
        </Button>
      </div>

      {debugInfo && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Wallet Address:</h4>
            <p className="font-mono text-sm break-all">{debugInfo.address}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">USDC Tokens:</h4>
            <div className="space-y-2">
              {Object.entries(debugInfo.usdc || {}).map(([coinType, info]: [string, any]) => (
                <div key={coinType} className="p-2 bg-muted rounded text-sm">
                  <p className="font-mono text-xs break-all mb-1">{coinType}</p>
                  <p>Balance: {info.balance} (Raw)</p>
                  <p>Formatted: {(parseFloat(info.balance) / 1000000).toFixed(6)} USDC</p>
                  <p>Exists: {info.exists ? '✅' : '❌'}</p>
                  {info.error && <p className="text-destructive">Error: {info.error}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">USDT Tokens:</h4>
            <div className="space-y-2">
              {Object.entries(debugInfo.usdt || {}).map(([coinType, info]: [string, any]) => (
                <div key={coinType} className="p-2 bg-muted rounded text-sm">
                  <p className="font-mono text-xs break-all mb-1">{coinType}</p>
                  <p>Balance: {info.balance} (Raw)</p>
                  <p>Formatted: {(parseFloat(info.balance) / 1000000).toFixed(6)} USDT</p>
                  <p>Exists: {info.exists ? '✅' : '❌'}</p>
                  {info.error && <p className="text-destructive">Error: {info.error}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">All Coin Resources:</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {debugInfo.resources?.map((resource: any, index: number) => (
                <div key={index} className="p-2 bg-muted rounded text-xs">
                  <p className="font-mono break-all mb-1">{resource.type}</p>
                  <p>Balance: {resource.balance}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">All Fungible Assets (New API):</h4>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {debugInfo.fungibleAssets?.map((asset: any, index: number) => (
                <div key={index} className="p-2 bg-muted rounded text-xs">
                  <p className="font-mono break-all mb-1">{asset.asset_type}</p>
                  <p>Raw Amount: {asset.amount}</p>
                  <p>Formatted: {asset.formatted}</p>
                  {asset.asset_type.toLowerCase().includes('usdc') && (
                    <p className="text-green-500 font-bold">🎯 POTENTIAL USDC!</p>
                  )}
                </div>
              ))}
              {(!debugInfo.fungibleAssets || debugInfo.fungibleAssets.length === 0) && (
                <p className="text-muted-foreground">No fungible assets found</p>
              )}
            </div>
          </div>

          {debugInfo.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
              Error: {debugInfo.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletDebug;