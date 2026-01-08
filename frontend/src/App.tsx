import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { WalletProvider } from "@/contexts/WalletContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Vault from "./pages/Vault";
import Agents from "./pages/Agents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Aptos testnet configuration
const walletAdapterConfig = {
  network: Network.TESTNET,
  autoConnect: true,
  optInWallets: ["Petra"], // Specifically opt-in to Petra wallet
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AptosWalletAdapterProvider {...walletAdapterConfig}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public route - no wallet connection required */}
              <Route path="/" element={<Index />} />
              
              {/* Protected routes - wallet connection required */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/vault" 
                element={
                  <ProtectedRoute>
                    <Vault />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/agents" 
                element={
                  <ProtectedRoute>
                    <Agents />
                  </ProtectedRoute>
                } 
              />
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </AptosWalletAdapterProvider>
  </QueryClientProvider>
);

export default App;
