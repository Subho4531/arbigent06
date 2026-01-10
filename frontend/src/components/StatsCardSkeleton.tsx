import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatsCardSkeletonProps {
  icon: LucideIcon;
  delay?: number;
}

const StatsCardSkeleton = ({ icon: Icon, delay = 0 }: StatsCardSkeletonProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl border border-border bg-card p-6 relative overflow-hidden"
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      
      <div className="space-y-2">
        {/* Main value skeleton */}
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
        
        {/* Sub value skeleton */}
        <div className="h-4 bg-muted/30 rounded animate-pulse w-3/4" />
        
        {/* Trend skeleton */}
        <div className="h-3 bg-muted/20 rounded animate-pulse w-1/2" />
      </div>
    </motion.div>
  );
};

export default StatsCardSkeleton;