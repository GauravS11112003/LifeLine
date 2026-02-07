"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type StatusType = "active" | "critical" | "standby" | "offline";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { color: string; bgColor: string; glowColor: string; pulseColor: string }
> = {
  active: {
    color: "text-dispatch-green",
    bgColor: "bg-dispatch-green/10",
    glowColor: "shadow-dispatch-green/50",
    pulseColor: "bg-dispatch-green",
  },
  critical: {
    color: "text-dispatch-red",
    bgColor: "bg-dispatch-red/10",
    glowColor: "shadow-dispatch-red/50",
    pulseColor: "bg-dispatch-red",
  },
  standby: {
    color: "text-dispatch-amber",
    bgColor: "bg-dispatch-amber/10",
    glowColor: "shadow-dispatch-amber/50",
    pulseColor: "bg-dispatch-amber",
  },
  offline: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    glowColor: "",
    pulseColor: "bg-muted-foreground",
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const shouldPulse = status === "active" || status === "critical";

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider",
        config.bgColor,
        config.color,
        status === "critical" && "border-dispatch-red/30",
        status === "active" && "border-dispatch-green/30",
        status === "standby" && "border-dispatch-amber/30",
        status === "offline" && "border-border",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {shouldPulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.pulseColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            config.pulseColor
          )}
        />
      </span>
      {label}
    </motion.div>
  );
}
