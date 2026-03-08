"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
  LayoutList,
  MonitorPlay,
  Podcast,
  Database,
  Clock,
  Activity,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveTranscript } from "@/components/LiveTranscript";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { IntelDeck } from "@/components/IntelDeck";
import { IncidentMap } from "@/components/IncidentMap";
import { CallHistoryDashboard } from "@/components/CallHistoryDashboard";
import { useMockStream } from "@/hooks/useMockStream";
import {
  useVoiceStream,
  type ConnectionStatus,
} from "@/hooks/useVoiceStream";
import { useFirebaseCalls } from "@/hooks/useFirebaseCalls";

type DashboardMode = "demo" | "live" | "archive";

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

function timeAgo(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function priorityColor(priority: string | null | undefined): string {
  switch (priority?.toUpperCase()) {
    case "CRITICAL": return "bg-dispatch-red";
    case "HIGH": return "bg-dispatch-amber";
    case "MEDIUM": return "bg-dispatch-blue";
    case "LOW": return "bg-dispatch-green";
    default: return "bg-muted-foreground";
  }
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
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams?.get("view");
  const [mode, setMode] = useState<DashboardMode>(() =>
    viewFromUrl === "archive" ? "archive" : "live"
  );

  // Sync mode when URL view param changes (e.g. navigating to /?view=archive)
  useEffect(() => {
    if (viewFromUrl === "archive" && mode !== "archive") setMode("archive");
    if (viewFromUrl !== "archive" && mode === "archive" && viewFromUrl != null) setMode("live");
  }, [viewFromUrl]);

  // Both hooks are always called (Rules of Hooks), but only one is "active"
  const mock = useMockStream(2000);
  const voice = useVoiceStream();

  // Connect / disconnect voice stream when mode changes (only for live)
  useEffect(() => {
    if (mode === "live") {
      voice.connect();
    } else {
      voice.disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Firebase: recent calls for live data strip
  const { calls: firebaseCalls, activeCalls, loading: firebaseLoading, error: firebaseError } = useFirebaseCalls();
  const recentCalls = firebaseCalls.slice(0, 5);
  const callsToday = firebaseCalls.filter((c) => {
    const t = new Date(c.startTime);
    const now = new Date();
    return t.getDate() === now.getDate() && t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
  }).length;

  // Select the active stream (archive mode has no stream)
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


  const connectionStatus =
    mode === "live" ? voice.connectionStatus : ("disconnected" as const);

  const hasDetectedCritical =
    detectedProtocols.includes("fire") ||
    detectedProtocols.includes("injury") ||
    detectedProtocols.includes("hazmat");

  // Determine overall status
  const getStatus = () => {
    if (mode === "archive") return "standby";
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
    if (mode === "archive") return "Archive";
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

  const handleModeSwitch = (target: DashboardMode) => {
    if (target === "archive") {
      setMode("archive");
      return;
    }
    if (target === "demo") {
      setMode("demo");
      mock.reset();
      return;
    }
    setMode("live");
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
        <div className="grid grid-cols-3 items-center gap-4 max-w-[1920px] mx-auto w-full">
          {/* Left: Branding */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Shield className="h-5 w-5 text-dispatch-cyan" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-dispatch-green animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-foreground uppercase">
                  Lifeline
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

          {/* Center: Mode Toggle (always centered in header) */}
          <div className="flex justify-center items-center">
            <div className="flex items-center gap-1 rounded-full border border-border/50 p-0.5 bg-secondary/30">
            <button
                onClick={() => mode !== "live" && handleModeSwitch("live")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all ${
                  mode === "live"
                    ? "bg-dispatch-red/10 text-dispatch-red shadow-sm border border-dispatch-red/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Podcast className="h-3 w-3" />
                Live
              </button>
              <button
                onClick={() => mode !== "archive" && handleModeSwitch("archive")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all ${
                  mode === "archive"
                    ? "bg-background text-dispatch-cyan shadow-sm border border-dispatch-cyan/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutList className="h-3 w-3" />
                Archive
              </button>
              
            </div>
          </div>

          {/* Right: Call Info & Controls */}
          <div className="flex items-center justify-end gap-4 min-w-0">
            {mode === "archive" ? (
              <div className="text-center">
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                  View
                </p>
                <p className="text-xs font-mono font-bold text-dispatch-cyan">
                  INCIDENT ARCHIVE
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}

            {mode !== "archive" && (
              <>
                <Separator orientation="vertical" className="h-8 opacity-30" />
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
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* ──── Firebase recent calls & stats strip (hidden in archive) ──── */}
      {mode !== "archive" && (
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex-shrink-0 glass-panel border-b border-border/40 px-3 py-2"
      >
        <div className="flex items-center gap-4 max-w-[1920px] mx-auto w-full">
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <Database className="h-3.5 w-3.5 text-dispatch-cyan" />
            <span>Live from Firebase</span>
          </div>
          <Separator orientation="vertical" className="h-6 opacity-40" />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-lg bg-dispatch-cyan/10 border border-dispatch-cyan/20 px-3 py-1.5">
              <Activity className="h-3.5 w-3.5 text-dispatch-cyan" />
              <span className="text-xs font-mono font-bold text-dispatch-cyan tabular-nums">{activeCalls.length}</span>
              <span className="text-[10px] font-mono text-muted-foreground">Active now</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-dispatch-blue/10 border border-dispatch-blue/20 px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-dispatch-blue" />
              <span className="text-xs font-mono font-bold text-dispatch-blue tabular-nums">{callsToday}</span>
              <span className="text-[10px] font-mono text-muted-foreground">Today</span>
            </div>
          </div>
          <Separator orientation="vertical" className="h-6 opacity-40" />
          <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
            {firebaseLoading ? (
              <span className="text-[10px] font-mono text-muted-foreground animate-pulse">Loading calls…</span>
            ) : firebaseError ? (
              <span className="text-[10px] font-mono text-destructive">{firebaseError}</span>
            ) : recentCalls.length === 0 ? (
              <span className="text-[10px] font-mono text-muted-foreground">No calls in Firebase yet</span>
            ) : (
              recentCalls.map((call) => (
                <button
                  type="button"
                  onClick={() => setMode("archive")}
                  key={call.callId}
                  className="flex-shrink-0 flex flex-col gap-0.5 rounded-md border border-border/50 bg-secondary/30 px-2.5 py-1.5 hover:bg-secondary/60 transition-colors min-w-0 max-w-[240px] text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${priorityColor(call.priority)} ${call.status === "active" ? "animate-pulse" : ""}`} />
                    <span className="text-[10px] font-mono text-foreground truncate">
                      {call.summary || call.mainConcern || "Call"} — {timeAgo(call.startTime)}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-auto" />
                  </div>
                  {call.contactNumber && (
                    <span className="text-[9px] font-mono text-dispatch-cyan truncate pl-4">
                      {call.contactNumber}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </motion.section>
      )}

      {/* ──── Main content: Archive (inline) or Bento Grid (Demo/Live) ──── */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {mode === "archive" ? (
          <CallHistoryDashboard embedded />
        ) : (
        <div className="flex-1 p-3 min-h-0 overflow-hidden">
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
            <IncidentMap intel={intel} />
          </motion.div>
        </div>
        </div>
        )}
      </main>

      {/* ──── Bottom Status Bar (hidden in archive) ──── */}
      {mode !== "archive" && (
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
      )}
    </div>
  );
}