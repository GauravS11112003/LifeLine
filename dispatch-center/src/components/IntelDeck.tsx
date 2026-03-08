"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Flame,
  HeartPulse,
  AlertTriangle,
  Users,
  Zap,
  ChevronRight,
  Crosshair,
  Car,
  Home,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IntelData, IntelProtocol } from "@/hooks/useMockStream";

interface IntelDeckProps {
  detectedProtocols: string[];
  isActive: boolean;
  intel: IntelData | null;
}

// ──── Protocol Icon & Color Mapping ────

interface ProtocolStyle {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PROTOCOL_STYLE_MAP: Record<string, ProtocolStyle> = {
  fire: { icon: Flame, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30" },
  injury: { icon: HeartPulse, color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/30" },
  medical: { icon: HeartPulse, color: "text-pink-400", bgColor: "bg-pink-500/10", borderColor: "border-pink-500/30" },
  hazmat: { icon: AlertTriangle, color: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30" },
  rescue: { icon: Users, color: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30" },
  shooter: { icon: Crosshair, color: "text-red-500", bgColor: "bg-red-600/10", borderColor: "border-red-600/30" },
  domestic: { icon: Home, color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
  traffic: { icon: Car, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  // New protocol styles for voice agent scenarios
  robbery: { icon: Shield, color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/30" },
  kidnapping: { icon: AlertTriangle, color: "text-red-500", bgColor: "bg-red-600/10", borderColor: "border-red-600/30" },
  assault: { icon: Crosshair, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30" },
  weapons: { icon: Crosshair, color: "text-red-500", bgColor: "bg-red-600/10", borderColor: "border-red-600/30" },
};

const DEFAULT_PROTOCOL_STYLE: ProtocolStyle = {
  icon: FileText, color: "text-gray-400", bgColor: "bg-gray-500/10", borderColor: "border-gray-500/30",
};

function getProtocolStyle(id: string): ProtocolStyle {
  return PROTOCOL_STYLE_MAP[id] || DEFAULT_PROTOCOL_STYLE;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
    HIGH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    MEDIUM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    LOW: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${colors[priority] || colors.MEDIUM}`}>
      {priority}
    </span>
  );
}

// ──── Main Unified Intel Deck ────

export function IntelDeck({ detectedProtocols, intel }: IntelDeckProps) {
  // Protocols from intel or keyword fallback
  const protocols: IntelProtocol[] =
    intel?.protocols && intel.protocols.length > 0
      ? intel.protocols
      : detectedProtocols.map((id) => ({
          id,
          label: id.charAt(0).toUpperCase() + id.slice(1) + " Protocol",
          description: "Detected via keyword analysis. Awaiting AI intel...",
          priority: "HIGH" as const,
        }));

  const hasContent = protocols.length > 0;

  return (
    <Card className="glass-panel h-full flex flex-col overflow-hidden min-h-0">
      {/* ── Header ── */}
      <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-dispatch-amber text-xs">
          <Zap className="h-4 w-4" />
          Protocols & Resources
          <div className="flex items-center gap-1.5 ml-auto">
            {protocols.length > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                {protocols.length} PROTO
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <Separator className="opacity-20" />

      {/* ── Scrollable content: summary → protocols → resources ── */}
      <CardContent className="p-0 flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {/* Incident Summary */}
            <AnimatePresence>
              {intel?.summary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-dispatch-cyan mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">
                        AI Incident Summary
                      </p>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        {intel.summary}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Protocols ── */}
            {protocols.length > 0 && (
              <div>
                <p className="text-[9px] font-mono text-dispatch-amber uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  Active Protocols
                </p>
                <div className="space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {protocols.map((protocol) => {
                      const style = getProtocolStyle(protocol.id);
                      const Icon = style.icon;
                      return (
                        <motion.div
                          key={protocol.id}
                          initial={{ opacity: 0, x: 30, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -30 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className={`rounded-lg border p-2.5 ${style.bgColor} ${style.borderColor}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-0.5 rounded-md p-1 ${style.bgColor}`}>
                              <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[11px] font-bold uppercase tracking-wide ${style.color}`}>
                                  {protocol.label}
                                </span>
                                <PriorityBadge priority={protocol.priority} />
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                {protocol.description}
                              </p>
                            </div>
                            <ChevronRight className={`h-3.5 w-3.5 mt-0.5 ${style.color} opacity-40`} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {!hasContent && (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Shield className="h-6 w-6 mb-2 opacity-30" />
                <p className="text-[10px] font-mono uppercase tracking-widest">
                  Monitoring for triggers...
                </p>
                <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">
                  Protocols & resources populate from call analysis
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
