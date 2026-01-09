// useArbiGent - React hook for ArbiGent agent management
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  arbiGentService, 
  AgentLog, 
  AgentState, 
  AgentConfig, 
  RiskLevel,
  VaultState 
} from '@/services/ArbiGentService';

export interface UseArbiGentReturn {
  // State
  isRunning: boolean;
  logs: AgentLog[];
  agentState: AgentState;
  runningDuration: string;
  
  // Actions
  startAgent: () => void;
  stopAgent: () => void;
  clearLogs: () => void;
  
  // Configuration
  updateConfig: (config: Partial<AgentConfig>) => void;
  updateVaultBalances: (balances: VaultState) => void;
  updatePrices: (prices: Record<string, number>) => void;
}

export const useArbiGent = (): UseArbiGentReturn => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [agentState, setAgentState] = useState<AgentState>(arbiGentService.getState());
  const [runningDuration, setRunningDuration] = useState('0m');
  
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set up callbacks on mount
  useEffect(() => {
    // Log callback
    arbiGentService.onLog((log) => {
      setLogs(prev => [...prev.slice(-99), log]);
    });

    // State change callback
    arbiGentService.onStateChange((state) => {
      setAgentState(state);
      setIsRunning(state.isRunning);
    });

    // Load existing logs
    setLogs(arbiGentService.getLogs());
    setAgentState(arbiGentService.getState());
    setIsRunning(arbiGentService.getState().isRunning);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Update running duration every second when agent is running
  useEffect(() => {
    if (isRunning) {
      durationIntervalRef.current = setInterval(() => {
        setRunningDuration(arbiGentService.getRunningDuration());
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setRunningDuration('0m');
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRunning]);

  const startAgent = useCallback(() => {
    arbiGentService.start();
  }, []);

  const stopAgent = useCallback(() => {
    arbiGentService.stop();
  }, []);

  const clearLogs = useCallback(() => {
    arbiGentService.clearLogs();
    setLogs([]);
  }, []);

  const updateConfig = useCallback((config: Partial<AgentConfig>) => {
    arbiGentService.updateConfig(config);
  }, []);

  const updateVaultBalances = useCallback((balances: VaultState) => {
    arbiGentService.updateVaultBalances(balances);
  }, []);

  const updatePrices = useCallback((prices: Record<string, number>) => {
    arbiGentService.updatePrices(prices);
  }, []);

  return {
    isRunning,
    logs,
    agentState,
    runningDuration,
    startAgent,
    stopAgent,
    clearLogs,
    updateConfig,
    updateVaultBalances,
    updatePrices,
  };
};

export default useArbiGent;
