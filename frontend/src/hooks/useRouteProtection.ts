import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

interface UseRouteProtectionOptions {
  redirectTo?: string;
  requireConnection?: boolean;
  onUnauthorized?: () => void;
}

export const useRouteProtection = (options: UseRouteProtectionOptions = {}) => {
  const { 
    redirectTo = '/', 
    requireConnection = true, 
    onUnauthorized 
  } = options;
  
  const { connected, connecting } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (requireConnection && !connecting && !connected) {
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        // Store the attempted route for redirect after connection
        sessionStorage.setItem('redirectAfterConnection', location.pathname);
        navigate(redirectTo, { replace: true });
      }
    }
  }, [connected, connecting, requireConnection, navigate, redirectTo, location.pathname, onUnauthorized]);

  return {
    isAuthorized: !requireConnection || connected,
    isLoading: connecting,
    canAccess: connected || !requireConnection
  };
};

// Hook for handling post-connection redirects
export const usePostConnectionRedirect = () => {
  const { connected } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (connected) {
      const redirectPath = sessionStorage.getItem('redirectAfterConnection');
      if (redirectPath && redirectPath !== '/') {
        sessionStorage.removeItem('redirectAfterConnection');
        navigate(redirectPath, { replace: true });
      }
    }
  }, [connected, navigate]);
};

// Hook for checking if a specific route requires wallet connection
export const useIsProtectedRoute = (path?: string) => {
  const location = useLocation();
  const currentPath = path || location.pathname;
  
  // Define which routes require wallet connection
  const protectedRoutes = ['/dashboard', '/vault', '/agents'];
  
  return protectedRoutes.some(route => currentPath.startsWith(route));
};

export default useRouteProtection;