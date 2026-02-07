"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Radio,
  Phone,
  PhoneOff,
  RotateCcw,
  Pause,
  Play,
  Shield,
  Wifi,
  WifiOff,
  Zap,
  MonitorPlay,
  Podcast,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveTranscript } from "@/components/LiveTranscript";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { IntelDeck } from "@/components/IntelDeck";
import { IncidentMap } from "@/components/IncidentMap";
import { useMockStream } from "@/hooks/useMockStream";
import {
  useVoiceStream,
  type ConnectionStatus,
} from "@/hooks/useVoiceStream";

type DashboardMode = "demo" | "live";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const config: Record<
    ConnectionStatus,
    { color: string; label: string; pulse: boolean }
  > = {
    connected: {
      color: "text-dispatch-green",
      label: "CONNECTED",
      pulse: false,
    },
    connecting: {
      color: "text-dispatch-amber",
      label: "CONNECTING...",
      pulse: true,
    },
    disconnected: {
      color: "text-muted-foreground",
      label: "DISCONNECTED",
      pulse: false,
    },
    error: {
      color: "text-dispatch-red",
      label: "ERROR",
      pulse: false,
    },
  };

  const c = config[status];

  return (
    <span className={`flex items-center gap-1 ${c.color}`}>
      {c.pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dispatch-amber opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-dispatch-amber" />
        </span>
      ) : status === "connected" ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      <span className="text-[10px] font-mono">{c.label}</span>
    </span>
  );
}

export function Dashboard() {
  const [mode, setMode] = useState<DashboardMode>("demo");

  // Both hooks are always called (Rules of Hooks), but only one is "active"
  const mock = useMockStream(2000);
  const voice = useVoiceStream();

  // Connect / disconnect voice stream when mode changes
  useEffect(() => {
    if (mode === "live") {
      voice.connect();
    } else {
      voice.disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Select the active stream
  const stream = mode === "demo" ? mock : voice;

  const {
    lines,
    isActive,
    volume,
    callDuration,
    currentIndex,
    totalLines,
    detectedProtocols,
    isComplete,
    intel,
    reset,
    togglePause,
  } = stream;

  const addressRequested = mode === "demo" ? mock.addressRequested : false;

  const connectionStatus =
    mode === "live" ? voice.connectionStatus : ("disconnected" as const);

  const hasDetectedCritical =
    detectedProtocols.includes("fire") ||
    detectedProtocols.includes("injury") ||
    detectedProtocols.includes("hazmat");

  // Determine overall status
  const getStatus = () => {
    if (mode === "live") {
      if (connectionStatus !== "connected") return "offline";
      if (hasDetectedCritical) return "critical";
      if (isActive) return "active";
      return "standby";
    }
    // Demo mode
    if (isComplete) return "standby";
    if (hasDetectedCritical) return "critical";
    if (isActive) return "active";
    return "offline";
  };

  const getStatusLabel = () => {
    if (mode === "live") {
      if (connectionStatus !== "connected") return "Offline";
      if (hasDetectedCritical) return "Critical";
      if (isActive) return "Call Active";
      return "Awaiting Call";
    }
    if (isComplete) return "Call Ended";
    if (hasDetectedCritical) return "Critical";
    if (isActive) return "Line Active";
    return "Paused";
  };

  const handleModeSwitch = () => {
    if (mode === "demo") {
      setMode("live");
    } else {
      setMode("demo");
      mock.reset();
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background grid-bg">
      {/* ──── Top Command Bar ──── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-shrink-0 glass-panel border-b border-border/50 px-4 py-2.5"
      >
        <div className="flex items-center justify-between max-w-[1920px] mx-auto w-full">
          {/* Left: Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Shield className="h-5 w-5 text-dispatch-cyan" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-dispatch-green animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-foreground uppercase">
                  Dispatch Command
                </h1>
                <p className="text-[9px] font-mono text-muted-foreground tracking-widest">
                  REAL-TIME INCIDENT MANAGEMENT SYSTEM v2.4
                </p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-8 mx-2 opacity-30" />
            <StatusBadge
              status={getStatus()}
              label={getStatusLabel()}
            />
          </div>

          {/* Center: Call Info */}
          <div className="flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 rounded-full border border-border/50 p-0.5 bg-secondary/30">
              <button
                onClick={() => mode !== "demo" && handleModeSwitch()}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all ${
                  mode === "demo"
                    ? "bg-background text-dispatch-blue shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MonitorPlay className="h-3 w-3" />
                Demo
              </button>
              <button
                onClick={() => mode !== "live" && handleModeSwitch()}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all ${
                  mode === "live"
                    ? "bg-dispatch-red/10 text-dispatch-red shadow-sm border border-dispatch-red/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Podcast className="h-3 w-3" />
                Live
              </button>
            </div>

            <Separator orientation="vertical" className="h-8 opacity-30" />

            <div className="text-center">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                Call Duration
              </p>
              <p className="text-lg font-mono font-bold text-dispatch-cyan tabular-nums">
                {formatDuration(callDuration)}
              </p>
            </div>
            <Separator orientation="vertical" className="h-8 opacity-30" />
            <div className="text-center">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                {intel?.incidentType || "Incident ID"}
              </p>
              <p className={`text-xs font-mono font-bold ${
                intel?.priority === "CRITICAL" ? "text-dispatch-red animate-pulse" :
                intel?.priority === "HIGH" ? "text-dispatch-amber" :
                "text-dispatch-amber"
              }`}>
                {intel ? intel.priority : "INC-2026-00742"}
              </p>
            </div>
            <Separator orientation="vertical" className="h-8 opacity-30" />
            <div className="text-center">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                Channel
              </p>
              <div className="flex items-center gap-1">
                {mode === "live" ? (
                  <ConnectionIndicator status={connectionStatus} />
                ) : (
                  <>
                    <Wifi className="h-3 w-3 text-dispatch-green" />
                    <p className="text-xs font-mono font-bold text-dispatch-green">
                      CH-7 DEMO
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {mode === "demo" && (
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                className="h-8 gap-1.5 text-xs font-mono border-border/50 hover:bg-secondary"
              >
                {isActive ? (
                  <>
                    <Pause className="h-3 w-3" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" /> RESUME
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="h-8 gap-1.5 text-xs font-mono border-border/50 hover:bg-secondary"
            >
              <RotateCcw className="h-3 w-3" /> RESET
            </Button>
            {mode === "live" ? (
              <Button
                size="sm"
                className={`h-8 gap-1.5 text-xs font-mono transition-all duration-300 ${
                  isActive
                    ? "bg-dispatch-red hover:bg-dispatch-red/80 animate-pulse shadow-lg shadow-dispatch-red/30"
                    : connectionStatus === "connected"
                    ? "bg-dispatch-green/20 text-dispatch-green border border-dispatch-green/30 hover:bg-dispatch-green/30"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {isActive ? (
                  <>
                    <Zap className="h-3 w-3 animate-pulse" /> CALL ACTIVE
                  </>
                ) : connectionStatus === "connected" ? (
                  <>
                    <Phone className="h-3 w-3" /> AWAITING CALL
                  </>
                ) : (
                  <>
                    <Phone className="h-3 w-3" /> STANDBY
                  </>
                )}
              </Button>
            ) : isComplete ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-mono text-dispatch-red border-dispatch-red/30 hover:bg-dispatch-red/10"
              >
                <PhoneOff className="h-3 w-3" /> ENDED
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-mono bg-dispatch-red hover:bg-dispatch-red/80"
              >
                <Phone className="h-3 w-3" /> LINE 7
              </Button>
            )}
          </div>
        </div>
      </motion.header>

      {/* ──── Main Bento Grid ──── */}
      <main className="flex-1 p-3 min-h-0 overflow-hidden">
        <div className="h-full grid grid-cols-12 grid-rows-1 gap-3 max-w-[1920px] mx-auto">
          {/* Left Panel — Live Transcript */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="col-span-3 min-h-0 overflow-hidden"
          >
            <LiveTranscript
              lines={lines}
              isActive={mode === "live" ? isActive || connectionStatus === "connected" : isActive}
              callDuration={callDuration}
            />
          </motion.div>

          {/* Center Panel — Waveform + Protocols & Resources */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="col-span-4 min-h-0 overflow-hidden flex flex-col gap-3"
          >
            {/* Waveform — fixed height */}
            <div className="flex-shrink-0" style={{ height: "35%" }}>
              <AudioVisualizer
                volume={volume}
                isActive={isActive}
              />
            </div>
            {/* Merged Protocols & Resources — fills remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <IntelDeck
                detectedProtocols={detectedProtocols}
                isActive={isActive}
                intel={intel}
              />
            </div>
          </motion.div>

          {/* Right Panel — Incident Location Map */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="col-span-5 min-h-0 overflow-hidden"
          >
            <IncidentMap intel={intel} addressRequested={addressRequested} />
          </motion.div>
        </div>
      </main>

      {/* ──── Bottom Status Bar ──── */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="flex-shrink-0 glass-panel border-t border-border/50 px-4 py-1.5"
      >
        <div className="flex items-center justify-between max-w-[1920px] mx-auto w-full">
          <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <Radio className="h-3 w-3" />
              {mode === "live" ? (
                <>
                  VOICE AGENT:{" "}
                  <span
                    className={
                      connectionStatus === "connected"
                        ? "text-dispatch-green"
                        : connectionStatus === "connecting"
                        ? "text-dispatch-amber"
                        : "text-dispatch-red"
                    }
                  >
                    {connectionStatus === "connected"
                      ? "CONNECTED"
                      : connectionStatus === "connecting"
                      ? "CONNECTING..."
                      : "DISCONNECTED"}
                  </span>
                </>
              ) : (
                <>
                  MODE:{" "}
                  <span className="text-dispatch-blue">DEMO SIMULATION</span>
                </>
              )}
            </span>
            <span>
              LATENCY:{" "}
              <span className="text-dispatch-cyan">
                {mode === "live" && connectionStatus === "connected"
                  ? "~80ms"
                  : "12ms"}
              </span>
            </span>
            <span>
              BUFFER:{" "}
              <span className="text-dispatch-cyan">0 PKT</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
            <span>
              TRANSCRIPT:{" "}
              <span className="text-foreground">
                {currentIndex}
                {mode === "demo" ? `/${totalLines}` : " LINES"}
              </span>
            </span>
            <span>
              PROTOCOLS:{" "}
              <span className="text-dispatch-amber">
                {detectedProtocols.length} ACTIVE
              </span>
            </span>
            <span>
              SYS:{" "}
              <span
                className={
                  mode === "live" && connectionStatus !== "connected"
                    ? "text-dispatch-amber"
                    : "text-dispatch-green"
                }
              >
                {mode === "live" && connectionStatus !== "connected"
                  ? "STANDBY"
                  : "NOMINAL"}
              </span>
            </span>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
