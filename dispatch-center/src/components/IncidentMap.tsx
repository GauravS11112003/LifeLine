"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Crosshair } from "lucide-react";
import type { IntelData } from "@/hooks/useMockStream";

// Dynamic import — Leaflet requires `window`, so disable SSR
const MapContent = dynamic(() => import("./MapContent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-lg bg-[#f0f4f8] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-gray-400">
        <MapPin className="h-5 w-5 animate-pulse opacity-40" />
        <span className="text-[9px] font-mono uppercase tracking-widest opacity-50">
          Loading map...
        </span>
      </div>
    </div>
  ),
});

interface IncidentMapProps {
  intel: (IntelData & { pendingAddress?: string | null }) | null;
}

export function IncidentMap({ intel }: IncidentMapProps) {
  const location = intel?.location;
  const hasLocation = !!(location && location.address !== "PENDING");
  const pendingAddress = !hasLocation && intel?.pendingAddress;

  return (
    <Card className={`glass-panel h-full flex flex-col overflow-hidden transition-colors duration-500 ${hasLocation ? "border-dispatch-red/20" : ""}`}>
      {/* Header */}
      <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-dispatch-cyan text-xs">
            <MapPin className={`h-4 w-4 ${hasLocation ? "text-dispatch-red" : ""}`} />
            Incident Location
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasLocation && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                LOCKED
              </Badge>
            )}
            <span className={`text-[10px] font-mono ${hasLocation ? "text-dispatch-red" : "text-muted-foreground"}`}>
              {hasLocation ? "TRACKING" : "STANDBY"}
            </span>
          </div>
        </div>
      </CardHeader>

      <Separator className="opacity-30" />

      {/* Map Area */}
      <CardContent className="p-2 flex-1 min-h-0 relative">
        <div className="w-full h-full rounded-lg overflow-hidden relative">
          <MapContent intel={intel} />

          {/* Coordinate overlay */}
          <AnimatePresence>
            {hasLocation && location && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-3 left-3 right-3 z-[1000]"
              >
                <div className="bg-background/85 backdrop-blur-md rounded-lg border border-border/50 p-3">
                  {/* Address row */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="rounded-md p-1 bg-dispatch-red/10">
                      <Navigation className="h-3.5 w-3.5 text-dispatch-red" />
                    </div>
                    <span className="text-sm font-bold text-foreground font-mono tracking-wide">
                      {location.address}
                    </span>
                  </div>
                  {/* Details row */}
                  <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Crosshair className="h-3 w-3 text-dispatch-cyan" />
                      {location.lat.toFixed(4)}°N, {Math.abs(location.lng).toFixed(4)}°W
                    </span>
                    <span className="text-dispatch-amber">{location.sector}</span>
                    {intel?.priority && (
                      <span className={`ml-auto font-bold ${
                        intel.priority === "CRITICAL" ? "text-dispatch-red animate-pulse" :
                        intel.priority === "HIGH" ? "text-dispatch-amber" :
                        "text-dispatch-blue"
                      }`}>
                        {intel.priority}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* "Awaiting / Geocoding" overlay when no location */}
          <AnimatePresence>
            {!hasLocation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full border-2 border-dashed animate-spin ${pendingAddress ? "border-dispatch-amber/40" : "border-muted-foreground/20"}`} style={{ animationDuration: pendingAddress ? "3s" : "8s" }} />
                    <MapPin className={`h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${pendingAddress ? "text-dispatch-amber/60 animate-pulse" : "text-muted-foreground/30"}`} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                    {pendingAddress ? "Geocoding Address..." : "Awaiting Location Intel"}
                  </span>
                  {pendingAddress && (
                    <span className="text-[9px] font-mono text-dispatch-amber/60 max-w-[200px] text-center truncate">
                      {intel?.pendingAddress}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}