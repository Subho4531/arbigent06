import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import AnimatedValue from "./AnimatedValue";
import ValueChangeIndicator from "./ValueChangeIndicator";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  delay?: number;
  isLoading?: boolean;
  isAnimated?: boolean;
  previousValue?: number;
  showChangeIndicator?: boolean;
  isUpdating?: boolean;
}

const StatsCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend, 
  delay = 0, 
  isLoading = false,
  isAnimated = false,
  previousValue,
  showChangeIndicator = false,
  isUpdating = false
}: StatsCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors relative overflow-hidden"
    >
      {/* Loading shimmer effect */}
      {isLoading && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      )}
      
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {isUpdating && !isLoading && (
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
          <Icon className={`h-5 w-5 transition-colors ${isLoading ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 bg-muted/50 rounded animate-pulse w-24" />
              {subValue && <div className="h-4 bg-muted/30 rounded animate-pulse w-32" />}
            </div>
          ) : (
            <>
              <p className="font-mono text-2xl font-bold text-foreground flex items-center gap-2">
                {isAnimated && typeof value === 'number' ? (
                  <AnimatedValue 
                    value={Math.abs(value)} 
                    prefix={value >= 0 ? '+$' : '-$'} 
                    decimals={2}
                    className="inline-block"
                  />
                ) : (
                  value
                )}
                {showChangeIndicator && typeof value === 'number' && (
                  <ValueChangeIndicator 
                    currentValue={value} 
                    previousValue={previousValue}
                    showIndicator={!isLoading}
                  />
                )}
              </p>
              {subValue && (
                <p className="text-sm text-muted-foreground mt-1">{subValue}</p>
              )}
            </>
          )}
        </div>
        
        {trend && !isLoading && (
          <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-mono ${
            trend.isPositive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
          }`}>
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </div>
        )}
        
        {isLoading && (
          <div className="h-6 bg-muted/30 rounded-full animate-pulse w-16" />
        )}
      </div>
    </motion.div>
  );
};

export default StatsCard;
