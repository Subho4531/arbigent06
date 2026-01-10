import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface UpdateNotificationProps {
  show: boolean;
  message: string;
  type?: 'success' | 'info' | 'profit' | 'loss';
  duration?: number;
  onHide?: () => void;
}

const UpdateNotification = ({ 
  show, 
  message, 
  type = 'info', 
  duration = 3000,
  onHide 
}: UpdateNotificationProps) => {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        onHide?.();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [show, duration, onHide]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'profit':
        return <TrendingUp className="h-4 w-4" />;
      case 'loss':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-success/90 text-success-foreground border-success/30';
      case 'profit':
        return 'bg-success/90 text-success-foreground border-success/30';
      case 'loss':
        return 'bg-destructive/90 text-destructive-foreground border-destructive/30';
      default:
        return 'bg-primary/90 text-primary-foreground border-primary/30';
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-20 right-4 z-50"
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border backdrop-blur-sm ${getStyles()}`}>
            {getIcon()}
            <span className="text-sm font-medium">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateNotification;