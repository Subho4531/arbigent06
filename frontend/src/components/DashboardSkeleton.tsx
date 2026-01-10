import { motion } from "framer-motion";
import { Wallet, TrendingUp, Bot, Activity } from "lucide-react";
import StatsCardSkeleton from "./StatsCardSkeleton";

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background dark relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/[0.07] rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/[0.07] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary/[0.03] to-orange-500/[0.03] rounded-full blur-3xl" />
      </div>
      
      <main className="pt-24 pb-16 relative z-10">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Page Header Skeleton */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <div className="h-12 bg-muted/50 rounded animate-pulse w-64 mb-2" />
              <div className="h-4 bg-muted/30 rounded animate-pulse w-48" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 bg-muted/30 rounded animate-pulse w-24" />
              <div className="h-8 bg-muted/30 rounded animate-pulse w-20" />
            </div>
          </motion.div>
          
          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCardSkeleton icon={Wallet} delay={0} />
            <StatsCardSkeleton icon={TrendingUp} delay={0.1} />
            <StatsCardSkeleton icon={Bot} delay={0.2} />
            <StatsCardSkeleton icon={Activity} delay={0.3} />
          </div>
          
          {/* Quick Actions Skeleton */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="h-6 bg-muted/50 rounded animate-pulse w-48" />
                <div className="flex gap-3">
                  <div className="h-8 bg-muted/30 rounded animate-pulse w-24" />
                  <div className="h-8 bg-muted/30 rounded animate-pulse w-32" />
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4 animate-pulse" />
                <div className="h-6 bg-muted/50 rounded animate-pulse w-48 mb-2" />
                <div className="h-4 bg-muted/30 rounded animate-pulse w-64 mb-6" />
                <div className="h-10 bg-muted/30 rounded animate-pulse w-40" />
              </div>
            </div>
          </motion.div>

          {/* Opportunities Table Skeleton */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="rounded-xl border border-border bg-card overflow-hidden relative">
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-6 bg-muted/50 rounded animate-pulse w-64 mb-2" />
                    <div className="h-4 bg-muted/30 rounded animate-pulse w-48" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-muted/30 rounded animate-pulse w-20" />
                    <div className="h-8 bg-muted/30 rounded animate-pulse w-24" />
                  </div>
                </div>
              </div>
              
              <div className="p-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mx-auto mb-4 animate-pulse" />
                <div className="h-6 bg-muted/50 rounded animate-pulse w-48 mx-auto mb-2" />
                <div className="h-4 bg-muted/30 rounded animate-pulse w-64 mx-auto" />
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default DashboardSkeleton;