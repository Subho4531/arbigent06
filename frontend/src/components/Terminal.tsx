import { motion } from "framer-motion";
import { Search, CheckCircle, AlertTriangle, Info, XCircle, Sparkles } from "lucide-react";

interface LogEntry {
  time: string;
  type: "SCAN" | "EXECUTE" | "WARNING" | "ERROR" | "INFO" | "SUCCESS";
  message: string;
  detail?: string;
}

interface TerminalProps {
  logs: LogEntry[];
  title?: string;
  maxHeight?: string;
  showPrompt?: boolean;
}

const Terminal = ({ logs, title = "agent_logs", maxHeight = "400px", showPrompt = true }: TerminalProps) => {
  const getTypeIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "SCAN": return Search;
      case "EXECUTE": return CheckCircle;
      case "SUCCESS": return Sparkles;
      case "WARNING": return AlertTriangle;
      case "ERROR": return XCircle;
      case "INFO": return Info;
      default: return Info;
    }
  };

  const getTypeColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "SCAN": return "text-blue-400";
      case "EXECUTE": return "text-green-400";
      case "SUCCESS": return "text-emerald-400";
      case "WARNING": return "text-yellow-400";
      case "ERROR": return "text-red-400";
      case "INFO": return "text-gray-400";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="terminal rounded-lg overflow-hidden shadow-2xl">
      {/* Terminal Header */}
      <div className="terminal-header flex items-center gap-2 px-4 py-3 bg-[hsl(220,13%,14%)] border-b border-[hsl(220,9%,22%)]">
        <div className="flex gap-2">
          <div className="terminal-dot-red" />
          <div className="terminal-dot-yellow" />
          <div className="terminal-dot-green" />
        </div>
        <span className="ml-4 text-sm text-gray-400 font-mono">{title}</span>
      </div>
      
      {/* Terminal Body */}
      <div 
        className="terminal-body bg-[hsl(220,13%,10%)] overflow-y-auto"
        style={{ maxHeight }}
      >
        {/* Initial prompt */}
        <div className="mb-4">
          <span className="text-primary">→</span>
          <span className="text-gray-400 ml-2">~</span>
          <span className="text-white ml-2">arbigent agent --start</span>
        </div>
        
        <div className="text-gray-500 mb-4 text-sm">
          .: Initializing agent processes...
        </div>
        
        {logs.map((log, index) => {
          const Icon = getTypeIcon(log.type);
          const colorClass = getTypeColor(log.type);
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="mb-3 pl-2 border-l-2 border-[hsl(220,9%,22%)] hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-gray-500 text-xs whitespace-nowrap">[{log.time}]</span>
                <Icon className={`h-4 w-4 mt-0.5 ${colorClass}`} />
                <div className="flex-1">
                  <span className={colorClass}>{log.type}</span>
                  <span className="text-gray-300 ml-2">{log.message}</span>
                  {log.detail && (
                    <p className="text-gray-500 text-sm mt-0.5">{log.detail}</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        
        {/* Cursor line */}
        {showPrompt && (
          <div className="mt-4 flex items-center">
            <span className="text-primary">→</span>
            <span className="text-gray-400 ml-2">~</span>
            <span className="ml-2 cursor-blink" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
