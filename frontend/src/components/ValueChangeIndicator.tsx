import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ValueChangeIndicatorProps {
  currentValue: number;
  previousValue?: number;
  showIndicator?: boolean;
  duration?: number;
}

const ValueChangeIndicator = ({ 
  currentValue, 
  previousValue, 
  showIndicator = true,
  duration = 2000 
}: ValueChangeIndicatorProps) => {
  const [showChange, setShowChange] = useState(false);
  const [changeType, setChangeType] = useState<'increase' | 'decrease' | null>(null);

  useEffect(() => {
    if (previousValue !== undefined && currentValue !== previousValue && showIndicator) {
      setChangeType(currentValue > previousValue ? 'increase' : 'decrease');
      setShowChange(true);
      
      const timer = setTimeout(() => {
        setShowChange(false);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [currentValue, previousValue, showIndicator, duration]);

  return (
    <AnimatePresence>
      {showChange && changeType && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: 10 }}
          transition={{ duration: 0.3 }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono ${
            changeType === 'increase' 
              ? 'bg-success/20 text-success border border-success/30' 
              : 'bg-destructive/20 text-destructive border border-destructive/30'
          }`}
        >
          {changeType === 'increase' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {changeType === 'increase' ? '+' : ''}
            {(currentValue - (previousValue || 0)).toFixed(2)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ValueChangeIndicator;