import React from 'react';
import { Loader2, Wallet, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
};

interface WalletConnectingProps {
  walletName?: string;
  onCancel?: () => void;
  className?: string;
}

export const WalletConnecting: React.FC<WalletConnectingProps> = ({
  walletName = 'Petra',
  onCancel,
  className = ''
}) => {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-primary" />
            <LoadingSpinner size="sm" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="font-medium">Connecting to {walletName}</h3>
            <p className="text-sm text-muted-foreground">
              Please approve the connection in your wallet
            </p>
          </div>
          
          <Badge variant="outline" className="animate-pulse">
            Waiting for approval...
          </Badge>
          
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface BalanceLoadingProps {
  tokens?: string[];
  className?: string;
}

export const BalanceLoading: React.FC<BalanceLoadingProps> = ({
  tokens = ['APT', 'USDC', 'USDT'],
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Fetching balances...</span>
      </div>
      
      <div className="space-y-1">
        {tokens.map((token) => (
          <div key={token} className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="font-medium">{token}</span>
            <div className="flex items-center space-x-2">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface NetworkSwitchingProps {
  targetNetwork?: string;
  className?: string;
}

export const NetworkSwitching: React.FC<NetworkSwitchingProps> = ({
  targetNetwork = 'Aptos Testnet',
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 p-3 bg-muted/50 rounded ${className}`}>
      <Wifi className="h-4 w-4 text-primary" />
      <LoadingSpinner size="sm" />
      <span className="text-sm">Switching to {targetNetwork}...</span>
    </div>
  );
};

interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  text = 'Loading...',
  size = 'sm',
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <LoadingSpinner size={size} />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
};

interface ButtonLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'wallet';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ButtonLoading: React.FC<ButtonLoadingProps> = ({
  loading,
  children,
  loadingText,
  disabled,
  onClick,
  variant = 'default',
  size = 'default',
  className = ''
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={loading || disabled}
      onClick={onClick}
      className={className}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {loading && loadingText ? loadingText : children}
    </Button>
  );
};

// Skeleton loading components
export const BalanceSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded animate-pulse">
          <div className="h-4 bg-muted rounded w-12"></div>
          <div className="h-4 bg-muted rounded w-20"></div>
        </div>
      ))}
    </div>
  );
};

export const WalletInfoSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
      <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
    </div>
  );
};

export default LoadingSpinner;