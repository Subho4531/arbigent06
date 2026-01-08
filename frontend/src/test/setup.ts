import '@testing-library/jest-dom';

// Mock window.aptos for Petra wallet testing
Object.defineProperty(window, 'aptos', {
  value: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    account: vi.fn(),
    network: vi.fn(),
    signAndSubmitTransaction: vi.fn(),
    signMessage: vi.fn(),
  },
  writable: true,
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});