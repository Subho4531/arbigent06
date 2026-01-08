import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Info,
  X 
} from 'lucide-react';
import { 
  FormattedError, 
  WalletErrorType,
  formatError 
} from '@/utils/errorHandling';

interface ErrorDisplayProps {
  error: Error | string | FormattedError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRecoveryActions?: boolean;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showRecoveryActions = true,
  className = ''
}) => {
  const formattedError = typeof error === 'object' && 'type' in error 
    ? error 
    : formatError(error);

  const getErrorIcon = (type: WalletErrorType) => {
    switch (type) {
      case WalletErrorType.WALLET_NOT_INSTALLED:
        return <ExternalLink className="h-4 w-4" />;
      case WalletErrorType.NETWORK_MISMATCH:
        return <Info className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getErrorVariant = (type: WalletErrorType) => {
    switch (type) {
      case WalletErrorType.USER_REJECTED:
        return 'default' as const;
      case WalletErrorType.NETWORK_MISMATCH:
        return 'default' as const;
      default:
        return 'destructive' as const;
    }
  };

  const handleInstallWallet = () => {
    window.open('https://petra.app/', '_blank');
  };

  return (
    <Alert variant={getErrorVariant(formattedError.type)} className={className}>
      {getErrorIcon(formattedError.type)}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <AlertTitle className="flex items-center gap-2">
            Error
            <Badge variant="outline" className="text-xs">
              {formattedError.type.replace(/_/g, ' ')}
            </Badge>
          </AlertTitle>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <AlertDescription className="mt-2">
          <div className="space-y-3">
            <p>{formattedError.message}</p>
            
            {showRecoveryActions && formattedError.recoveryActions.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-2">How to fix this:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {formattedError.recoveryActions.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ol>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try Again
                </Button>
              )}
              
              {formattedError.type === WalletErrorType.WALLET_NOT_INSTALLED && (
                <Button variant="default" size="sm" onClick={handleInstallWallet}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Install Petra Wallet
                </Button>
              )}
            </div>
            
            {formattedError.originalError && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Technical Details
                </summary>
                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
                  {formattedError.originalError}
                </pre>
              </details>
            )}
          </div>
        </AlertDescription>
      </div>
    </Alert>
  );
};

// Wallet-specific error display
interface WalletErrorDisplayProps {
  error: Error | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const WalletErrorDisplay: React.FC<WalletErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = ''
}) => {
  if (!error) return null;

  return (
    <ErrorDisplay
      error={error}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showRecoveryActions={true}
      className={className}
    />
  );
};

// Loading error display for balance operations
interface BalanceErrorDisplayProps {
  error: Error | string | null;
  onRefresh?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const BalanceErrorDisplay: React.FC<BalanceErrorDisplayProps> = ({
  error,
  onRefresh,
  onDismiss,
  className = ''
}) => {
  if (!error) return null;

  return (
    <ErrorDisplay
      error={error}
      onRetry={onRefresh}
      onDismiss={onDismiss}
      showRecoveryActions={true}
      className={className}
    />
  );
};

// Network error display
interface NetworkErrorDisplayProps {
  error: Error | string | null;
  onSwitchNetwork?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const NetworkErrorDisplay: React.FC<NetworkErrorDisplayProps> = ({
  error,
  onSwitchNetwork,
  onDismiss,
  className = ''
}) => {
  if (!error) return null;

  const formattedError = formatError(error);
  
  return (
    <Alert variant="default" className={className}>
      <Info className="h-4 w-4" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <AlertTitle>Network Issue</AlertTitle>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <AlertDescription className="mt-2">
          <div className="space-y-3">
            <p>{formattedError.message}</p>
            
            {onSwitchNetwork && (
              <Button variant="default" size="sm" onClick={onSwitchNetwork}>
                Switch to Testnet
              </Button>
            )}
          </div>
        </AlertDescription>
      </div>
    </Alert>
  );
};

export default ErrorDisplay;