import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { WalletConnecting } from '@/components/LoadingStates';
import { WalletErrorDisplay } from '@/components/ErrorDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowLeft } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/' 
}) => {
  const { connected, connecting, error, connect, clearError } = useWallet();
  const location = useLocation();

  // Clear any existing errors when the component mounts
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

  // If wallet is connecting, show loading state
  if (connecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <WalletConnecting 
          walletName="Petra"
          className="w-full max-w-md"
        />
      </div>
    );
  }

  // If wallet is not connected, show connection prompt
  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>Wallet Connection Required</CardTitle>
            <p className="text-sm text-muted-foreground">
              You need to connect your Petra wallet to access this page.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error && (
              <WalletErrorDisplay 
                error={error}
                onRetry={() => connect('Petra')}
                onDismiss={clearError}
              />
            )}
            
            <div className="space-y-3">
              <Button 
                onClick={() => connect('Petra')} 
                className="w-full"
                disabled={connecting}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Connect Petra Wallet
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = redirectTo}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground text-center">
              <p>Don't have Petra wallet?</p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => window.open('https://petra.app/', '_blank')}
                className="h-auto p-0 text-xs"
              >
                Download it here
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If wallet is connected, render the protected content
  return <>{children}</>;
};

// Higher-order component for easier usage
export const withWalletProtection = <P extends object>(
  Component: React.ComponentType<P>,
  redirectTo?: string
) => {
  const ProtectedComponent = (props: P) => (
    <ProtectedRoute redirectTo={redirectTo}>
      <Component {...props} />
    </ProtectedRoute>
  );
  
  ProtectedComponent.displayName = `withWalletProtection(${Component.displayName || Component.name})`;
  
  return ProtectedComponent;
};

export default ProtectedRoute;