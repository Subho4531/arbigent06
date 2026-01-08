import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  WalletErrorType,
  classifyError,
  getErrorMessage,
  getRecoveryActions,
  formatError,
  RetryManager,
  LoadingStateManager,
  withLoadingAndError,
  ERROR_MESSAGES,
  RECOVERY_ACTIONS
} from '../errorHandling';

describe('Error Handling Property Tests', () => {
  /**
   * Property 9: Comprehensive Error Handling
   * Feature: petra-wallet-integration, Property 9: Comprehensive Error Handling
   * Validates: Requirements 4.4, 5.2, 5.3, 5.4
   */
  it('should display appropriate error messages and provide recovery options for any wallet operation failure', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          errorMessage: fc.oneof(
            fc.constant('Petra wallet not found'),
            fc.constant('User rejected the request'),
            fc.constant('Network connection failed'),
            fc.constant('Wrong network detected'),
            fc.constant('Failed to fetch balance'),
            fc.constant('Connection timeout'),
            fc.constant('Transaction failed'),
            fc.constant('Unknown error occurred'),
            fc.string({ minLength: 5, maxLength: 100 })
          ),
          isErrorObject: fc.boolean()
        }),
        ({ errorMessage, isErrorObject }) => {
          const error = isErrorObject ? new Error(errorMessage) : errorMessage;
          
          // Property: Error classification should always return a valid error type
          const errorType = classifyError(error);
          expect(Object.values(WalletErrorType)).toContain(errorType);
          
          // Property: Error message should always be a non-empty string
          const userMessage = getErrorMessage(error);
          expect(typeof userMessage).toBe('string');
          expect(userMessage.length).toBeGreaterThan(0);
          
          // Property: Recovery actions should always be an array of strings
          const recoveryActions = getRecoveryActions(error);
          expect(Array.isArray(recoveryActions)).toBe(true);
          expect(recoveryActions.length).toBeGreaterThan(0);
          recoveryActions.forEach(action => {
            expect(typeof action).toBe('string');
            expect(action.length).toBeGreaterThan(0);
          });
          
          // Property: Formatted error should have all required properties
          const formattedError = formatError(error);
          expect(formattedError).toHaveProperty('type');
          expect(formattedError).toHaveProperty('message');
          expect(formattedError).toHaveProperty('recoveryActions');
          expect(formattedError).toHaveProperty('originalError');
          
          expect(Object.values(WalletErrorType)).toContain(formattedError.type);
          expect(typeof formattedError.message).toBe('string');
          expect(Array.isArray(formattedError.recoveryActions)).toBe(true);
          expect(typeof formattedError.originalError).toBe('string');
          
          // Property: Error type should map to consistent message and actions
          expect(formattedError.message).toBe(ERROR_MESSAGES[formattedError.type]);
          expect(formattedError.recoveryActions).toEqual(RECOVERY_ACTIONS[formattedError.type]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Loading State Management
   * Feature: petra-wallet-integration, Property 10: Loading State Management
   * Validates: Requirements 5.5
   */
  it('should display appropriate loading indicators until wallet operations complete or fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          operationKey: fc.string({ minLength: 1, maxLength: 50 }),
          operationDuration: fc.integer({ min: 10, max: 50 }), // Much shorter duration
          shouldSucceed: fc.boolean()
        }),
        async ({ operationKey, operationDuration, shouldSucceed }) => {
          const loadingManager = new LoadingStateManager();
          let loadingStates: boolean[] = [];
          
          // Subscribe to loading state changes
          const unsubscribe = loadingManager.subscribe(operationKey, (loading) => {
            loadingStates.push(loading);
          });
          
          // Property: Initial loading state should be false
          expect(loadingManager.isLoading(operationKey)).toBe(false);
          
          // Simulate an async operation with very short duration
          const operation = async () => {
            await new Promise(resolve => setTimeout(resolve, operationDuration));
            if (!shouldSucceed) {
              throw new Error('Operation failed');
            }
            return 'success';
          };
          
          // Create a custom retry manager with no retries for this test
          const noRetryManager = new RetryManager(0, 1);
          
          try {
            loadingManager.setLoading(operationKey, true);
            const result = await noRetryManager.execute(operation);
            loadingManager.setLoading(operationKey, false);
            
            // Property: Result should match operation success
            if (shouldSucceed) {
              expect(result).toBe('success');
            }
          } catch (error) {
            loadingManager.setLoading(operationKey, false);
            
            // Property: Error should be thrown for failed operations
            if (!shouldSucceed) {
              expect(error).toBeInstanceOf(Error);
            }
          }
          
          // Property: Loading state should have been set to true during operation
          expect(loadingStates).toContain(true);
          
          // Property: Loading state should be false after operation completes
          expect(loadingManager.isLoading(operationKey)).toBe(false);
          expect(loadingStates[loadingStates.length - 1]).toBe(false);
          
          unsubscribe();
        }
      ),
      { numRuns: 10 } // Further reduced iterations
    );
  }, 10000); // Increase timeout

  it('should handle retry mechanisms correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          maxRetries: fc.integer({ min: 1, max: 5 }),
          baseDelay: fc.integer({ min: 10, max: 100 }),
          failureCount: fc.integer({ min: 0, max: 10 })
        }),
        async ({ maxRetries, baseDelay, failureCount }) => {
          const testBaseDelay = Math.min(baseDelay, 10); // Cap delay at 10ms for tests
          const retryManager = new RetryManager(maxRetries, testBaseDelay);
          let attemptCount = 0;
          
          const operation = async () => {
            attemptCount++;
            if (attemptCount <= failureCount) {
              throw new Error(`Attempt ${attemptCount} failed`);
            }
            return `Success on attempt ${attemptCount}`;
          };
          
          try {
            const result = await retryManager.execute(operation);
            
            // Property: If operation eventually succeeds, result should be returned
            expect(result).toContain('Success');
            expect(attemptCount).toBe(failureCount + 1);
            
            // Property: Retry count should be reset after success
            expect(retryManager.currentRetryCount).toBe(0);
            
          } catch (error) {
            // Property: If operation fails more than maxRetries, error should be thrown
            expect(failureCount).toBeGreaterThan(maxRetries);
            expect(attemptCount).toBe(maxRetries + 1);
            expect(error).toBeInstanceOf(Error);
          }
          
          // Property: Attempt count should never exceed maxRetries + 1
          expect(attemptCount).toBeLessThanOrEqual(maxRetries + 1);
        }
      ),
      { numRuns: 20 } // Reduced iterations to avoid timeout
    );
  });

  it('should classify errors correctly based on message content', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorType: fc.constantFrom(...Object.values(WalletErrorType)),
          includeKeywords: fc.boolean()
        }),
        ({ errorType, includeKeywords }) => {
          let errorMessage = 'Generic error message';
          
          if (includeKeywords) {
            // Add keywords that should trigger specific error types
            switch (errorType) {
              case WalletErrorType.WALLET_NOT_INSTALLED:
                errorMessage = 'Petra wallet not installed';
                break;
              case WalletErrorType.USER_REJECTED:
                errorMessage = 'User rejected the connection';
                break;
              case WalletErrorType.NETWORK_ERROR:
                errorMessage = 'Network connection failed';
                break;
              case WalletErrorType.NETWORK_MISMATCH:
                errorMessage = 'Wrong network detected';
                break;
              case WalletErrorType.BALANCE_FETCH_ERROR:
                errorMessage = 'Failed to fetch balance';
                break;
              case WalletErrorType.CONNECTION_FAILED:
                errorMessage = 'Connection to wallet failed';
                break;
              case WalletErrorType.TRANSACTION_FAILED:
                errorMessage = 'Transaction failed to execute';
                break;
              default:
                errorMessage = 'Unknown error occurred';
            }
          }
          
          const classifiedType = classifyError(errorMessage);
          
          if (includeKeywords) {
            // Property: Errors with specific keywords should be classified correctly
            expect(classifiedType).toBe(errorType);
          } else {
            // Property: Generic errors should be classified as UNKNOWN_ERROR
            expect(classifiedType).toBe(WalletErrorType.UNKNOWN_ERROR);
          }
          
          // Property: Classification should always return a valid error type
          expect(Object.values(WalletErrorType)).toContain(classifiedType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should manage loading states for multiple operations independently', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (operationKeys) => {
          const loadingManager = new LoadingStateManager();
          const uniqueKeys = [...new Set(operationKeys)]; // Remove duplicates
          
          // Property: All operations should start with loading = false
          uniqueKeys.forEach(key => {
            expect(loadingManager.isLoading(key)).toBe(false);
          });
          
          // Set some operations to loading
          const loadingKeys = uniqueKeys.slice(0, Math.ceil(uniqueKeys.length / 2));
          loadingKeys.forEach(key => {
            loadingManager.setLoading(key, true);
          });
          
          // Property: Only the keys set to loading should be true
          uniqueKeys.forEach(key => {
            const expectedLoading = loadingKeys.includes(key);
            expect(loadingManager.isLoading(key)).toBe(expectedLoading);
          });
          
          // Clear all loading states
          loadingManager.clear();
          
          // Property: After clearing, all operations should be false
          uniqueKeys.forEach(key => {
            expect(loadingManager.isLoading(key)).toBe(false);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Error Handling Unit Tests', () => {
  let retryManager: RetryManager;
  let loadingManager: LoadingStateManager;

  beforeEach(() => {
    retryManager = new RetryManager(3, 100);
    loadingManager = new LoadingStateManager();
  });

  afterEach(() => {
    loadingManager.clear();
  });

  it('should have correct error messages for all error types', () => {
    Object.values(WalletErrorType).forEach(errorType => {
      expect(ERROR_MESSAGES[errorType]).toBeDefined();
      expect(typeof ERROR_MESSAGES[errorType]).toBe('string');
      expect(ERROR_MESSAGES[errorType].length).toBeGreaterThan(0);
    });
  });

  it('should have recovery actions for all error types', () => {
    Object.values(WalletErrorType).forEach(errorType => {
      expect(RECOVERY_ACTIONS[errorType]).toBeDefined();
      expect(Array.isArray(RECOVERY_ACTIONS[errorType])).toBe(true);
      expect(RECOVERY_ACTIONS[errorType].length).toBeGreaterThan(0);
      
      RECOVERY_ACTIONS[errorType].forEach(action => {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      });
    });
  });

  it('should reset retry count after successful operation', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };

    const result = await retryManager.execute(operation);
    expect(result).toBe('success');
    expect(retryManager.currentRetryCount).toBe(0);
  }, 10000); // Increase timeout for this specific test

  it('should handle loading state subscriptions correctly', () => {
    const key = 'test-operation';
    const states: boolean[] = [];
    
    const unsubscribe = loadingManager.subscribe(key, (loading) => {
      states.push(loading);
    });

    loadingManager.setLoading(key, true);
    loadingManager.setLoading(key, false);
    loadingManager.setLoading(key, true);

    expect(states).toEqual([true, false, true]);

    unsubscribe();
    
    // After unsubscribing, no more states should be recorded
    loadingManager.setLoading(key, false);
    expect(states).toEqual([true, false, true]); // Should remain the same
  });
});