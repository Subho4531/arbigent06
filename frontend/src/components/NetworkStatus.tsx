import React from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Wifi } from 'lucide-react';

interface NetworkStatusProps {
  showSwitchButton?: boolean;
  className?: string;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  showSwitchButton = true, 
  className = '' 
}) => {
  const { 
    network, 
    connected, 
    isCorrectNetwork, 
    switchToTestnet, 
    getNetworkSwitchPrompt,
    error 
  } = useWallet();

  // Don't show anything if wallet is not connected
  if (!connected || !network) {
    return null;
  }

  const handleSwitchNetwork = async () => {
    try {
      await switchToTestnet();
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Network Status Badge */}
      <div className="flex items-center gap-2">
        <Wifi className="h-4 w-4" />
        <span className="text-sm font-medium">Network:</span>
        <Badge 
          variant={isCorrectNetwork ? "default" : "destructive"}
          className="flex items-center gap-1"
        >
          {isCorrectNetwork ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {network.displayName || network.name}
        </Badge>
      </div>

      {/* Wrong Network Alert */}
      {!isCorrectNetwork && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{getNetworkSwitchPrompt()}</span>
            {showSwitchButton && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleSwitchNetwork}
                className="ml-2"
              >
                Switch to Testnet
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Network Error Display */}
      {error && error.includes('network') && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Compact version for header display
export const NetworkStatusCompact: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { network, connected, isCorrectNetwork } = useWallet();

  if (!connected || !network) {
    return null;
  }

  return (
    <Badge 
      variant={isCorrectNetwork ? "secondary" : "destructive"}
      className={`flex items-center gap-1 ${className}`}
    >
      {isCorrectNetwork ? (
        <CheckCircle className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {network.name.toUpperCase()}
    </Badge>
  );
};

export default NetworkStatus;