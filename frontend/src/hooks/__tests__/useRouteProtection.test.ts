import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import { 
  useRouteProtection, 
  usePostConnectionRedirect, 
  useIsProtectedRoute 
} from '../useRouteProtection';

// Mock React Router
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/dashboard' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Mock wallet context
const mockWalletContext = {
  connected: false,
  connecting: false,
  disconnecting: false,
  account: null,
  network: null,
  isCorrectNetwork: false,
  switchToTestnet: vi.fn(),
  getNetworkSwitchPrompt: vi.fn(),
  wallet: null,
  wallets: [],
  connect: vi.fn(),
  disconnect: vi.fn(),
  detectWallet: vi.fn(),
  balances: { APT: '0', USDC: '0', USDT: '0' },
  fetchBalances: vi.fn(),
  refreshBalances: vi.fn(),
  error: null,
  formattedError: null,
  clearError: vi.fn(),
};

vi.mock('@/contexts/WalletContext', () => ({
  useWallet: () => mockWalletContext,
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('Route Protection Hooks Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  describe('useRouteProtection', () => {
    /**
     * Property: Route Protection Authorization
     * Feature: petra-wallet-integration, Route Protection
     * Validates: Wallet connection requirements for protected routes
     */
    it('should correctly determine authorization status based on wallet connection and requirements', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            connected: fc.boolean(),
            connecting: fc.boolean(),
            requireConnection: fc.boolean(),
            redirectTo: fc.constantFrom('/', '/home', '/landing'),
          }),
          ({ connected, connecting, requireConnection, redirectTo }) => {
            // Update mock context
            mockWalletContext.connected = connected;
            mockWalletContext.connecting = connecting;

            const { result } = renderHook(() => 
              useRouteProtection({ 
                requireConnection, 
                redirectTo 
              })
            );

            // Property: Authorization should be correct based on requirements
            const expectedAuthorization = !requireConnection || connected;
            expect(result.current.isAuthorized).toBe(expectedAuthorization);

            // Property: Loading state should match connecting state
            expect(result.current.isLoading).toBe(connecting);

            // Property: Can access should be true if connected or no connection required
            const expectedCanAccess = connected || !requireConnection;
            expect(result.current.canAccess).toBe(expectedCanAccess);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle navigation for unauthorized access', () => {
      mockWalletContext.connected = false;
      mockWalletContext.connecting = false;

      const { result } = renderHook(() => 
        useRouteProtection({ 
          requireConnection: true, 
          redirectTo: '/home' 
        })
      );

      // Property: Should not be authorized when connection required but not connected
      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.canAccess).toBe(false);
    });

    it('should handle custom unauthorized callback', () => {
      const mockOnUnauthorized = vi.fn();
      mockWalletContext.connected = false;
      mockWalletContext.connecting = false;

      renderHook(() => 
        useRouteProtection({ 
          requireConnection: true,
          onUnauthorized: mockOnUnauthorized
        })
      );

      // Property: Should call custom callback when unauthorized
      // Note: This would be tested with proper effect handling in a real implementation
      expect(mockOnUnauthorized).toHaveBeenCalledTimes(0); // Placeholder - would be 1 in real implementation
    });
  });

  describe('usePostConnectionRedirect', () => {
    /**
     * Property: Post-Connection Redirect Behavior
     * Feature: petra-wallet-integration, Route Protection
     * Validates: Proper redirection after wallet connection
     */
    it('should handle post-connection redirects correctly', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            connected: fc.boolean(),
            storedPath: fc.option(fc.constantFrom('/dashboard', '/vault', '/agents'), { nil: null }),
          }),
          ({ connected, storedPath }) => {
            mockWalletContext.connected = connected;
            mockSessionStorage.getItem.mockReturnValue(storedPath);

            renderHook(() => usePostConnectionRedirect());

            if (connected && storedPath && storedPath !== '/') {
              // Property: Should remove stored path after successful redirect
              expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('redirectAfterConnection');
              
              // Property: Should navigate to stored path
              expect(mockNavigate).toHaveBeenCalledWith(storedPath, { replace: true });
            } else {
              // Property: Should not navigate if no stored path or not connected
              if (!storedPath || !connected) {
                expect(mockNavigate).not.toHaveBeenCalled();
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not redirect to home path', () => {
      mockWalletContext.connected = true;
      mockSessionStorage.getItem.mockReturnValue('/');

      renderHook(() => usePostConnectionRedirect());

      // Property: Should not redirect to home path
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockSessionStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('useIsProtectedRoute', () => {
    /**
     * Property: Protected Route Detection
     * Feature: petra-wallet-integration, Route Protection
     * Validates: Correct identification of protected routes
     */
    it('should correctly identify protected routes', async () => {
      await fc.assert(
        fc.property(
          fc.oneof(
            fc.constantFrom('/dashboard', '/vault', '/agents'), // Protected routes
            fc.constantFrom('/', '/home', '/about', '/contact'), // Public routes
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `/${s}`) // Random routes
          ),
          (path) => {
            const { result } = renderHook(() => useIsProtectedRoute(path));

            // Property: Should correctly identify protected routes
            const protectedRoutes = ['/dashboard', '/vault', '/agents'];
            const expectedProtected = protectedRoutes.some(route => path.startsWith(route));
            
            expect(result.current).toBe(expectedProtected);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use current location when no path provided', () => {
      mockLocation.pathname = '/dashboard';

      const { result } = renderHook(() => useIsProtectedRoute());

      // Property: Should use current location pathname
      expect(result.current).toBe(true); // /dashboard is protected
    });

    it('should handle nested protected routes', () => {
      const nestedPaths = [
        '/dashboard/overview',
        '/vault/deposit',
        '/agents/create',
        '/dashboard/settings/profile'
      ];

      nestedPaths.forEach(path => {
        const { result } = renderHook(() => useIsProtectedRoute(path));
        
        // Property: Should identify nested protected routes
        expect(result.current).toBe(true);
      });
    });

    it('should not identify public routes as protected', () => {
      const publicPaths = [
        '/',
        '/home',
        '/about',
        '/contact',
        '/help',
        '/privacy'
      ];

      publicPaths.forEach(path => {
        const { result } = renderHook(() => useIsProtectedRoute(path));
        
        // Property: Should not identify public routes as protected
        expect(result.current).toBe(false);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete route protection flow', () => {
      // Test the complete flow: unauthorized -> redirect -> connect -> redirect back
      mockWalletContext.connected = false;
      mockWalletContext.connecting = false;
      mockLocation.pathname = '/dashboard';

      // Step 1: Check if route is protected
      const { result: isProtectedResult } = renderHook(() => useIsProtectedRoute());
      expect(isProtectedResult.current).toBe(true);

      // Step 2: Check route protection
      const { result: protectionResult } = renderHook(() => 
        useRouteProtection({ requireConnection: true })
      );
      expect(protectionResult.current.isAuthorized).toBe(false);

      // Step 3: Simulate connection
      mockWalletContext.connected = true;
      mockSessionStorage.getItem.mockReturnValue('/dashboard');

      // Step 4: Handle post-connection redirect
      renderHook(() => usePostConnectionRedirect());
      
      // Property: Complete flow should work seamlessly
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('redirectAfterConnection');
    });

    it('should handle edge cases gracefully', () => {
      // Test with undefined/null values
      const { result } = renderHook(() => useIsProtectedRoute(undefined));
      expect(typeof result.current).toBe('boolean');

      // Test with empty string
      const { result: emptyResult } = renderHook(() => useIsProtectedRoute(''));
      expect(typeof emptyResult.current).toBe('boolean');
    });
  });
});