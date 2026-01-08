/// <reference types="vite/client" />

// Petra wallet window interface
interface Window {
  aptos?: {
    connect(): Promise<{ address: string; publicKey: string }>;
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;
    getAccount(): Promise<{ address: string; publicKey: string }>;
    getNetwork(): Promise<{ name: string; chainId: string; url: string }>;
    changeNetwork(network: { name: string; chainId: string; url: string }): Promise<void>;
    signAndSubmitTransaction(transaction: any): Promise<any>;
    signMessage(message: { message: string; nonce: string }): Promise<{ signature: string }>;
  };
}