import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: "green" | "amber" | "blue";
  delay?: number;
}

const FeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  badge, 
  badgeColor = "green",
  delay = 0 
}: FeatureCardProps) => {
  const badgeColors = {
    green: "bg-success/20 text-success border-success/30",
    amber: "bg-warning/20 text-warning border-warning/30",
    blue: "bg-primary/20 text-primary border-primary/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card/50 p-6 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative z-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-display text-lg tracking-wide text-foreground">{title}</h3>
        </div>
        
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        
        {badge && (
          <div className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-mono ${badgeColors[badgeColor]}`}>
            {badge}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default FeatureCard;
