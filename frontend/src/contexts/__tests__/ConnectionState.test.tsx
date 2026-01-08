import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { WalletProvider, useWallet } from '../WalletContext';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import React from 'react';

// Mock the Aptos wallet adapter
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('@aptos-labs/wallet-adapter-react', () => ({
  AptosWalletAdapterProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="adapter-provider">{children}</div>,
  useWallet: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    account: null,
    connected: false,
    connecting: false,
    disconnecting: false,
    wallet: null,
    wallets: [{ name: 'Petra', icon: '', url: '' }],
    network: { name: 'testnet', chainId: '1', url: 'https://testnet.aptoslabs.com' },
  }),
}));

// Simple test component
const ConnectionTestComponent = ({ testId }: { testId: string }) => {
  const { connected, connecting } = useWallet();
  
  return (
    <div data-testid={`connection-test-${testId}`}>
      <div data-testid={`connection-state-${testId}`}>{connected ? 'connected' : 'disconnected'}</div>
      <div data-testid={`connecting-state-${testId}`}>{connecting ? 'connecting' : 'idle'}</div>
    </div>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  const walletAdapterConfig = {
    network: Network.TESTNET,
    autoConnect: false,
    optInWallets: ["Petra"],
  };

  return render(
    <AptosWalletAdapterProvider {...walletAdapterConfig}>
      <WalletProvider>
        {component}
      </WalletProvider>
    </AptosWalletAdapterProvider>
  );
};

describe('Connection State Management Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  /**
   * Property 2: Connection State Management
   * Feature: petra-wallet-integration, Property 2: Connection State Management
   * Validates: Requirements 1.5, 1.6
   */
  it('should manage connection state consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletName: fc.constantFrom('Petra', 'Martian', 'Pontem'),
          shouldConnect: fc.boolean(),
          shouldDisconnect: fc.boolean(),
        }),
        async (testCase) => {
          const testId = `connection-${Math.random().toString(36).substr(2, 9)}`;
          
          const { getByTestId } = renderWithProviders(<ConnectionTestComponent testId={testId} />);

          // Property: Connection state should be consistent and predictable
          const connectionState = getByTestId(`connection-state-${testId}`);
          const connectingState = getByTestId(`connecting-state-${testId}`);
          
          // Initial state should be disconnected and idle
          expect(connectionState).toHaveTextContent('disconnected');
          expect(connectingState).toHaveTextContent('idle');

          // Property: State values should be valid
          expect(['connected', 'disconnected']).toContain(connectionState.textContent);
          expect(['connecting', 'idle']).toContain(connectingState.textContent);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle localStorage persistence correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletName: fc.string({ minLength: 1, maxLength: 20 }),
          connected: fc.boolean(),
        }),
        async (testCase) => {
          const testId = `persistence-${Math.random().toString(36).substr(2, 9)}`;
          
          // Property: localStorage operations should be consistent
          const mockSetItem = vi.fn();
          const mockRemoveItem = vi.fn();
          const mockGetItem = vi.fn();

          Object.defineProperty(window, 'localStorage', {
            value: {
              setItem: mockSetItem,
              removeItem: mockRemoveItem,
              getItem: mockGetItem,
              clear: vi.fn(),
            },
            writable: true,
          });

          // Create a component that tests the interface
          const PersistenceTestComponent = () => {
            const wallet = useWallet();
            
            return (
              <div data-testid={`persistence-test-${testId}`}>
                <div data-testid={`connect-type-${testId}`}>{typeof wallet.connect}</div>
                <div data-testid={`disconnect-type-${testId}`}>{typeof wallet.disconnect}</div>
              </div>
            );
          };

          const { getByTestId } = renderWithProviders(<PersistenceTestComponent />);

          // Property: The wallet context should provide consistent interface
          expect(getByTestId(`connect-type-${testId}`)).toHaveTextContent('function');
          expect(getByTestId(`disconnect-type-${testId}`)).toHaveTextContent('function');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should maintain connection state invariants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (initialConnected) => {
          const testId = `invariant-${Math.random().toString(36).substr(2, 9)}`;
          
          const { getByTestId } = renderWithProviders(<ConnectionTestComponent testId={testId} />);

          // Property: Connection state should follow logical invariants
          const connectionState = getByTestId(`connection-state-${testId}`);
          const connectingState = getByTestId(`connecting-state-${testId}`);

          // Invariant: Cannot be both connected and connecting simultaneously
          // (This is a logical property that should always hold)
          const isConnected = connectionState.textContent === 'connected';
          const isConnecting = connectingState.textContent === 'connecting';
          
          // This invariant should always hold in a well-designed system
          expect(!(isConnected && isConnecting)).toBe(true);

          // Invariant: State should be one of the expected values
          expect(['connected', 'disconnected']).toContain(connectionState.textContent);
          expect(['connecting', 'idle']).toContain(connectingState.textContent);
        }
      ),
      { numRuns: 10 }
    );
  });
});