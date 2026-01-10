import { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

const AnimatedValue = ({ 
  value, 
  prefix = '', 
  suffix = '', 
  decimals = 2, 
  duration = 0.8,
  className = ''
}: AnimatedValueProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const spring = useSpring(value, { 
    stiffness: 100, 
    damping: 30,
    restDelta: 0.001
  });
  
  const display = useTransform(spring, (latest) => {
    return `${prefix}${latest.toFixed(decimals)}${suffix}`;
  });

  useEffect(() => {
    spring.set(value);
    setDisplayValue(value);
  }, [value, spring]);

  return (
    <motion.span 
      className={className}
      initial={{ scale: 1 }}
      animate={{ scale: displayValue !== value ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span>{display}</motion.span>
    </motion.span>
  );
};

export default AnimatedValue;