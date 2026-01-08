import { Aptos, AptosConfig, Network, Account, InputTransactionData } from '@aptos-labs/ts-sdk';

// Smart contract configuration
const CONTRACT_ADDRESS = '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9';
const MODULE_NAME = 'swap';

// Transaction result interface
export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// Swap rate interface
export interface SwapRate {
  inputAmount: string;
  outputAmount: string;
  rate: number;
}

export class SmartContractService {
  private aptos: Aptos;

  constructor(network: Network = Network.TESTNET) {
    const config = new AptosConfig({ network });
    this.aptos = new Aptos(config);
  }

  /**
   * Initialize USDC token (only needs to be called once by deployer)
   */
  async initializeUSDC(account: Account): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::initialize_usdc`,
          functionArguments: [],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Initialize USDC error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Initialize USDT token (only needs to be called once by deployer)
   */
  async initializeUSDT(account: Account): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::initialize_usdt`,
          functionArguments: [],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Initialize USDT error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Mint USDC to user (for testing purposes)
   */
  async mintUSDC(account: Account, amount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::mint_usdc`,
          functionArguments: [amount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Mint USDC error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Mint USDT to user (for testing purposes)
   */
  async mintUSDT(account: Account, amount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::mint_usdt`,
          functionArguments: [amount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Mint USDT error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Swap APT to USDC (vault deposit logic)
   */
  async swapAPTtoUSDC(account: Account, aptAmount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_apt_to_usdc`,
          functionArguments: [aptAmount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Swap APT to USDC error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Swap APT to USDT (vault deposit logic)
   */
  async swapAPTtoUSDT(account: Account, aptAmount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_apt_to_usdt`,
          functionArguments: [aptAmount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Swap APT to USDT error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Swap USDC to APT (vault withdrawal logic - burns USDC)
   */
  async swapUSDCtoAPT(account: Account, usdcAmount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_usdc_to_apt`,
          functionArguments: [usdcAmount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Swap USDC to APT error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Swap USDT to APT (vault withdrawal logic - burns USDT)
   */
  async swapUSDTtoAPT(account: Account, usdtAmount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_usdt_to_apt`,
          functionArguments: [usdtAmount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Swap USDT to APT error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Swap USDC to USDT
   */
  async swapUSDCtoUSDT(account: Account, usdcAmount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_usdc_to_usdt`,
          functionArguments: [usdcAmount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Swap USDC to USDT error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Swap USDT to USDC
   */
  async swapUSDTtoUSDC(account: Account, usdtAmount: string): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::swap_usdt_to_usdc`,
          functionArguments: [usdtAmount],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Swap USDT to USDC error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get swap rate between tokens
   */
  async getSwapRate(fromToken: string, toToken: string, amount: string): Promise<SwapRate | null> {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_swap_rate`,
          functionArguments: [fromToken.toUpperCase(), toToken.toUpperCase(), amount],
        },
      });

      const outputAmount = result[0] as string;
      const inputNum = parseFloat(amount);
      const outputNum = parseFloat(outputAmount);
      const rate = outputNum / inputNum;

      return {
        inputAmount: amount,
        outputAmount,
        rate
      };
    } catch (error) {
      console.error('Get swap rate error:', error);
      return null;
    }
  }

  /**
   * Check profitability for arbitrage
   */
  async checkProfitability(inputAmount: string): Promise<{ profitable: boolean; profit: string } | null> {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::check_profitability`,
          functionArguments: [inputAmount],
        },
      });

      const profitable = result[0] as boolean;
      const profit = result[1] as string;

      return { profitable, profit };
    } catch (error) {
      console.error('Check profitability error:', error);
      return null;
    }
  }

  /**
   * Execute arbitrage transaction
   */
  async executeArbitrage(
    account: Account, 
    inputAmount: string, 
    expectedOutput: string, 
    tokenPair: string
  ): Promise<TransactionResult> {
    try {
      const transaction: InputTransactionData = {
        data: {
          function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::execute_arbitrage`,
          functionArguments: [inputAmount, expectedOutput, Array.from(new TextEncoder().encode(tokenPair))],
        },
      };

      const committedTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return { success: true, hash: committedTxn.hash };
    } catch (error) {
      console.error('Execute arbitrage error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const smartContractService = new SmartContractService(Network.TESTNET);
export default SmartContractService;