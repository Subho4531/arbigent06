import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  NetworkValidator, 
  NetworkSwitcher, 
  APTOS_TESTNET_CONFIG,
  APTOS_MAINNET_CONFIG,
  APTOS_DEVNET_CONFIG,
  NETWORK_CONFIGS,
  DEFAULT_NETWORK
} from '../network';

describe('Network Configuration', () => {
  describe('NetworkValidator', () => {
    /**
     * Property 3: Network Configuration Enforcement
     * Feature: petra-wallet-integration, Property 3: Network Configuration Enforcement
     * Validates: Requirements 2.1, 2.2, 2.4
     */
    it('should enforce testnet configuration and validate network switching requirements', async () => {
      await fc.assert(
        fc.property(
          fc.record({
            // Generate various network states that might come from wallet adapter
            currentNetwork: fc.record({
              name: fc.constantFrom('testnet', 'mainnet', 'devnet', 'unknown'),
              chainId: fc.oneof(
                fc.constant('1'), // mainnet
                fc.constant('2'), // testnet  
                fc.constant('3'), // devnet
                fc.integer({ min: 4, max: 999 }).map(String), // other chains
                fc.integer({ min: 1, max: 999 }) // number format
              ),
              url: fc.option(fc.webUrl(), { nil: undefined })
            }),
            expectedNetwork: fc.constantFrom('testnet', 'mainnet', 'devnet')
          }),
          ({ currentNetwork, expectedNetwork }) => {
            const expectedConfig = NETWORK_CONFIGS[expectedNetwork];
            
            // Test network validation logic
            const isCorrect = NetworkValidator.isCorrectNetwork(currentNetwork, expectedConfig);
            
            // Property: Network validation should be consistent and accurate
            if (currentNetwork.chainId && expectedConfig.chainId) {
              // If both have chain IDs, validation should be based on chain ID match
              const chainIdMatch = currentNetwork.chainId.toString() === expectedConfig.chainId;
              expect(isCorrect).toBe(chainIdMatch);
            } else if (currentNetwork.name && expectedConfig.name) {
              // Fallback to name comparison
              const nameMatch = currentNetwork.name === expectedConfig.name;
              expect(isCorrect).toBe(nameMatch);
            } else {
              // If neither chain ID nor name match, should be false
              expect(isCorrect).toBe(false);
            }
            
            // Test testnet-specific validation (requirement 2.1)
            const isTestnet = NetworkValidator.isConnectedToTestnet(currentNetwork);
            const shouldBeTestnet = currentNetwork.chainId === '2' || 
                                  (currentNetwork.chainId === 2) ||
                                  (currentNetwork.name === 'testnet' && (!currentNetwork.chainId || currentNetwork.chainId === '2'));
            expect(isTestnet).toBe(shouldBeTestnet);
            
            // Test network configuration retrieval
            if (expectedNetwork in NETWORK_CONFIGS) {
              const retrievedConfig = NetworkValidator.getNetworkConfig(expectedNetwork);
              expect(retrievedConfig).toEqual(expectedConfig);
              expect(NetworkValidator.isSupportedNetwork(expectedNetwork)).toBe(true);
            }
            
            // Test display name consistency
            const displayName = NetworkValidator.getNetworkDisplayName(expectedNetwork);
            if (expectedConfig) {
              expect(displayName).toBe(expectedConfig.displayName);
            } else {
              expect(displayName).toBe(expectedNetwork);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in network validation', () => {
      // Test null/undefined inputs
      expect(NetworkValidator.isCorrectNetwork(null, APTOS_TESTNET_CONFIG)).toBe(false);
      expect(NetworkValidator.isCorrectNetwork(undefined, APTOS_TESTNET_CONFIG)).toBe(false);
      
      // Test empty objects
      expect(NetworkValidator.isCorrectNetwork({}, APTOS_TESTNET_CONFIG)).toBe(false);
      
      // Test unsupported networks
      expect(NetworkValidator.isSupportedNetwork('unsupported')).toBe(false);
      expect(NetworkValidator.getNetworkConfig('unsupported')).toBe(null);
    });
  });

  describe('NetworkSwitcher', () => {
    it('should generate appropriate network switch prompts', () => {
      const prompt = NetworkSwitcher.getNetworkSwitchPrompt(APTOS_TESTNET_CONFIG);
      expect(prompt).toContain(APTOS_TESTNET_CONFIG.displayName);
      expect(prompt).toContain('switch');
      expect(prompt).toContain('wallet');
    });

    it('should handle browser environment checks', async () => {
      // Test non-browser environment
      const originalWindow = global.window;
      delete (global as any).window;
      
      const result = await NetworkSwitcher.switchToNetwork(APTOS_TESTNET_CONFIG);
      expect(result).toBe(false);
      
      // Restore window
      global.window = originalWindow;
    });
  });

  describe('Network Configuration Constants', () => {
    it('should have valid network configurations', () => {
      // Test that all network configs have required properties
      Object.values(NETWORK_CONFIGS).forEach(config => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('chainId');
        expect(config).toHaveProperty('rpcUrl');
        expect(config).toHaveProperty('displayName');
        expect(config.chainId).toBeTruthy();
        expect(config.rpcUrl).toMatch(/^https?:\/\//);
      });
      
      // Test specific configurations
      expect(APTOS_TESTNET_CONFIG.name).toBe('testnet');
      expect(APTOS_TESTNET_CONFIG.chainId).toBe('2');
      expect(APTOS_MAINNET_CONFIG.chainId).toBe('1');
      expect(APTOS_DEVNET_CONFIG.chainId).toBe('3');
      
      // Test default network
      expect(DEFAULT_NETWORK).toEqual(APTOS_TESTNET_CONFIG);
    });

    it('should have consistent network mapping', () => {
      expect(NETWORK_CONFIGS.testnet).toEqual(APTOS_TESTNET_CONFIG);
      expect(NETWORK_CONFIGS.mainnet).toEqual(APTOS_MAINNET_CONFIG);
      expect(NETWORK_CONFIGS.devnet).toEqual(APTOS_DEVNET_CONFIG);
    });
  });
});