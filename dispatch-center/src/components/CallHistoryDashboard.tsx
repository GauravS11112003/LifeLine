"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Filter,
  LayoutDashboard,
  MapPin,
  Phone,
  Search,
  Shield,
  Database,
  BarChart3,
  Flame,
  HeartPulse,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useFirebaseCalls, type FirebaseCall } from "@/hooks/useFirebaseCalls";

const STATUS_OPTIONS = ["All", "Open", "Dispatched", "Resolved", "Unfounded"] as const;
const PRIORITY_OPTIONS = ["All", "TBD", "Low", "Medium", "High", "Critical"] as const;
const EMERGENCY_OPTIONS = ["All", "Fire", "Medical", "Police", "Other"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];
type PriorityFilter = (typeof PRIORITY_OPTIONS)[number];
type EmergencyFilter = (typeof EMERGENCY_OPTIONS)[number];

type CallStatus = Exclude<StatusFilter, "All">;
type CallPriority = Exclude<PriorityFilter, "All">;
type CallEmergency = Exclude<EmergencyFilter, "All">;

interface CallRecord {
  id: string;
  caller: string;
  phone: string;
  emergency: CallEmergency;
  summary: string;
  location: string;
  timestamp: string;
  status: CallStatus;
  priority: CallPriority;
  extras?: string[];
}

const CALLS: CallRecord[] = [
  {
    id: "INC-2026-00811",
    caller: "Unknown Caller",
    phone: "(437) 702-3596",
    emergency: "Other",
    summary: "Caller reports distress, no clear emergency type yet.",
    location: "Location pending",
    timestamp: "2026-02-07T15:20:07",
    status: "Open",
    priority: "TBD",
    extras: ["Awaiting address"],
  },
  {
    id: "INC-2026-00805",
    caller: "Lucas",
    phone: "(408) 330-2857",
    emergency: "Medical",
    summary: "Chest pain, shortness of breath. EMT dispatched.",
    location: "Ocean Avenue",
    timestamp: "2026-02-07T14:48:58",
    status: "Dispatched",
    priority: "High",
    extras: ["Unit 12 en route"],
  },
  {
    id: "INC-2026-00803",
    caller: "Liam",
    phone: "(408) 233-1111",
    emergency: "Other",
    summary: "Caller reports suspicious activity, no immediate threat.",
    location: "King Street",
    timestamp: "2026-02-07T14:47:21",
    status: "Open",
    priority: "TBD",
    extras: ["Awaiting triage"],
  },
  {
    id: "INC-2026-00798",
    caller: "Bob",
    phone: "(408) 211-0080",
    emergency: "Fire",
    summary: "Structure fire reported behind commercial block.",
    location: "Gary Street",
    timestamp: "2026-02-07T14:44:28",
    status: "Open",
    priority: "Critical",
    extras: ["Multiple callers"],
  },
  {
    id: "INC-2026-00791",
    caller: "Maya",
    phone: "(415) 229-7741",
    emergency: "Police",
    summary: "Break-in in progress, suspect visible.",
    location: "14th Street & Pine",
    timestamp: "2026-02-07T14:12:05",
    status: "Dispatched",
    priority: "High",
    extras: ["Unit 9 on scene"],
  },
  {
    id: "INC-2026-00782",
    caller: "Sofia",
    phone: "(650) 402-9910",
    emergency: "Medical",
    summary: "Minor injury, caller declined transport.",
    location: "Union Square",
    timestamp: "2026-02-07T13:52:44",
    status: "Resolved",
    priority: "Medium",
    extras: ["Closed by EMS"],
  },
];

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mainConcernToEmergency(mainConcern: string | null | undefined): CallEmergency {
  if (!mainConcern) return "Other";
  const s = mainConcern.toLowerCase();
  if (s.includes("medical") || s.includes("ems") || s.includes("injury")) return "Medical";
  if (s.includes("fire") || s.includes("blaze")) return "Fire";
  if (s.includes("robbery") || s.includes("assault") || s.includes("police") || s.includes("kidnap")) return "Police";
  return "Other";
}

const PRIORITY_MAP: Record<string, CallPriority> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical", TBD: "TBD",
  Low: "Low", Medium: "Medium", High: "High", Critical: "Critical",
};

function firebaseCallToRecord(c: FirebaseCall): CallRecord {
  const raw = (c.priority ?? "TBD").toString();
  const priority: CallPriority = PRIORITY_MAP[raw] ?? "TBD";
  const status: CallStatus = c.status === "active" ? "Open" : "Resolved";
  return {
    id: c.callId,
    caller: "Unknown Caller",
    phone: c.contactNumber ?? "—",
    emergency: mainConcernToEmergency(c.mainConcern),
    summary: c.summary ?? "Call logged.",
    location: c.locationToldByCaller ?? "Pending",
    timestamp: c.startTime,
    status,
    priority,
    extras: c.status === "active" ? ["Live"] : undefined,
  };
}

function statusClass(status: CallStatus) {
  switch (status) {
    case "Open":
      return "border-dispatch-blue/30 text-dispatch-blue bg-dispatch-blue/10";
    case "Dispatched":
      return "border-dispatch-amber/30 text-dispatch-amber bg-dispatch-amber/10";
    case "Resolved":
      return "border-dispatch-green/30 text-dispatch-green bg-dispatch-green/10";
    case "Unfounded":
      return "border-border text-muted-foreground bg-muted";
    default:
      return "border-border text-muted-foreground bg-muted";
  }
}

function priorityClass(priority: CallPriority) {
  switch (priority) {
    case "Critical":
      return "border-dispatch-red/30 text-dispatch-red bg-dispatch-red/10";
    case "High":
      return "border-dispatch-amber/30 text-dispatch-amber bg-dispatch-amber/10";
    case "Medium":
      return "border-dispatch-blue/30 text-dispatch-blue bg-dispatch-blue/10";
    case "Low":
      return "border-dispatch-green/30 text-dispatch-green bg-dispatch-green/10";
    case "TBD":
    default:
      return "border-border text-muted-foreground bg-muted";
  }
}

interface CallHistoryDashboardProps {
  /** When true, render only the content (no header) for embedding in main Dashboard */
  embedded?: boolean;
}

export function CallHistoryDashboard({ embedded = false }: CallHistoryDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [emergencyFilter, setEmergencyFilter] = useState<EmergencyFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");

  const { calls: firebaseCalls, loading: firebaseLoading, error: firebaseError } = useFirebaseCalls();
  const allCalls = useMemo(() => {
    const fromFirebase = firebaseCalls.map(firebaseCallToRecord);
    return fromFirebase.length > 0 ? fromFirebase : CALLS;
  }, [firebaseCalls]);

  const handleClear = () => {
    setStatusFilter("All");
    setPriorityFilter("All");
    setEmergencyFilter("All");
    setSearchTerm("");
  };

  const filteredCalls = useMemo(() => {
    return allCalls.filter((call) => {
      const matchesStatus = statusFilter === "All" || call.status === statusFilter;
      const matchesPriority =
        priorityFilter === "All" || call.priority === priorityFilter;
      const matchesEmergency =
        emergencyFilter === "All" || call.emergency === emergencyFilter;
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        `${call.caller} ${call.location} ${call.summary} ${call.id}`
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase());

      return matchesStatus && matchesPriority && matchesEmergency && matchesSearch;
    });
  }, [allCalls, statusFilter, priorityFilter, emergencyFilter, searchTerm]);

  const totals = useMemo(() => {
    return {
      open: allCalls.filter((call) => call.status === "Open").length,
      dispatched: allCalls.filter((call) => call.status === "Dispatched").length,
      resolved: allCalls.filter((call) => call.status === "Resolved").length,
      unfounded: allCalls.filter((call) => call.status === "Unfounded").length,
    };
  }, [allCalls]);

  const priorityDistribution = useMemo(() => {
    const dist: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, TBD: 0 };
    allCalls.forEach((c) => {
      const p = c.priority in dist ? c.priority : "TBD";
      dist[p]++;
    });
    const max = Math.max(1, ...Object.values(dist));
    return { dist, max };
  }, [allCalls]);

  const emergencyDistribution = useMemo(() => {
    const dist: Record<string, number> = { Fire: 0, Medical: 0, Police: 0, Other: 0 };
    allCalls.forEach((c) => {
      const e = c.emergency in dist ? c.emergency : "Other";
      dist[e]++;
    });
    const max = Math.max(1, ...Object.values(dist));
    return { dist, max };
  }, [allCalls]);

  const statusDistribution = useMemo(() => {
    const dist = { Open: totals.open, Dispatched: totals.dispatched, Resolved: totals.resolved, Unfounded: totals.unfounded };
    const max = Math.max(1, ...Object.values(dist));
    return { dist, max };
  }, [totals]);

  const mainContent = (
    <main
      className={
        embedded
          ? "flex-1 flex flex-col min-h-0 overflow-hidden px-4 py-3"
          : "flex-1 flex flex-col min-h-0 overflow-hidden px-4 py-3 max-w-[1920px] mx-auto w-full"
      }
    >
      <div className="grid grid-cols-[7fr_3fr] gap-4 h-full min-h-0 overflow-hidden flex-1">
        {/* Left 70%: Stats, Filters, Case Queue */}
        <div className="flex flex-col gap-2 min-w-0 min-h-0 overflow-hidden">
          <motion.section
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-4 gap-2 flex-shrink-0"
          >
            {[
              { label: "Open", value: totals.open, tone: "text-dispatch-blue" },
              { label: "Dispatched", value: totals.dispatched, tone: "text-dispatch-amber" },
              { label: "Resolved", value: totals.resolved, tone: "text-dispatch-green" },
              { label: "Unfounded", value: totals.unfounded, tone: "text-muted-foreground" },
            ].map((stat) => (
              <Card key={stat.label} className="glass-panel flex-shrink-0">
                <CardContent className="p-2.5">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className={`text-xl font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </motion.section>

          <Card className="glass-panel flex-shrink-0">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[9px] font-mono px-2"
                  onClick={handleClear}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-2 px-3 pb-3 pt-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="h-8 rounded border border-border bg-background px-2 text-[11px] font-mono"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Priority</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                  className="h-8 rounded border border-border bg-background px-2 text-[11px] font-mono"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Emergency</span>
                <select
                  value={emergencyFilter}
                  onChange={(e) => setEmergencyFilter(e.target.value as EmergencyFilter)}
                  className="h-8 rounded border border-border bg-background px-2 text-[11px] font-mono"
                >
                  {EMERGENCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Search</span>
                <div className="flex items-center gap-1.5 rounded border border-border bg-background px-2 h-8">
                  <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Caller, location..."
                    className="flex-1 bg-transparent text-[11px] font-mono outline-none min-w-0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel flex-1 min-h-0 flex flex-col overflow-hidden">
            <CardHeader className="py-1.5 px-3 flex-shrink-0">
              <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                Case Queue
              </CardTitle>
            </CardHeader>
            <Separator className="opacity-30 flex-shrink-0" />
            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="grid grid-cols-[100px_90px_110px_100px_1fr_120px_100px_90px] gap-1.5 px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border/50 flex-shrink-0">
                <span>Priority</span>
                <span>Caller</span>
                <span>Contact</span>
                <span>Type</span>
                <span>Summary</span>
                <span>Location</span>
                <span>Time</span>
                <span>Status</span>
              </div>
              <div className="overflow-auto min-h-0 flex-1 divide-y divide-border/40">
                {filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    className="grid grid-cols-[100px_90px_110px_100px_1fr_120px_100px_90px] gap-1.5 px-3 py-2 text-[11px] hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <Badge variant="outline" className={`text-[9px] ${priorityClass(call.priority)}`}>
                        {call.priority}
                      </Badge>
                      <span className="text-[9px] font-mono text-muted-foreground truncate">{call.id}</span>
                    </div>
                    <span className="font-medium text-foreground truncate">{call.caller}</span>
                    <span className="text-dispatch-cyan font-mono text-[10px] truncate">{call.phone}</span>
                    <span className="text-foreground truncate">{call.emergency}</span>
                    <div className="min-w-0">
                      <span className="text-foreground line-clamp-1">{call.summary}</span>
                      {call.extras?.length ? (
                        <span className="text-[9px] font-mono text-muted-foreground">{call.extras.join(" • ")}</span>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground text-[10px] truncate">{call.location}</span>
                    <span className="text-muted-foreground text-[10px] font-mono">{formatTimestamp(call.timestamp)}</span>
                    <Badge variant="outline" className={statusClass(call.status)}>
                      {call.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 30%: Priority, Emergency, Status charts */}
        <div className="flex flex-col gap-2 min-w-0 min-h-0 overflow-hidden">
          <motion.section
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="flex-shrink-0"
          >
            <Card className="glass-panel">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Priority distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="flex flex-col gap-1.5">
                  {(["Critical", "High", "Medium", "Low", "TBD"] as const).map((p) => {
                    const count = priorityDistribution.dist[p] ?? 0;
                    const pct = priorityDistribution.max > 0 ? (count / priorityDistribution.max) * 100 : 0;
                    const barColor =
                      p === "Critical" ? "bg-dispatch-red" :
                      p === "High" ? "bg-dispatch-amber" :
                      p === "Medium" ? "bg-dispatch-blue" :
                      p === "Low" ? "bg-dispatch-green" : "bg-muted";
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <span className="w-12 text-[9px] font-mono uppercase text-muted-foreground">{p}</span>
                        <div className="flex-1 h-4 rounded bg-muted/50 overflow-hidden min-w-0">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.4 }}
                            className={`h-full rounded ${barColor}`}
                          />
                        </div>
                        <span className="w-5 text-right text-[10px] font-mono font-bold tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex-shrink-0"
          >
            <Card className="glass-panel">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Emergency category
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="flex flex-col gap-1.5">
                  {(["Fire", "Medical", "Police", "Other"] as const).map((e) => {
                    const count = emergencyDistribution.dist[e] ?? 0;
                    const pct = emergencyDistribution.max > 0 ? (count / emergencyDistribution.max) * 100 : 0;
                    const barColor =
                      e === "Fire" ? "bg-orange-500" :
                      e === "Medical" ? "bg-red-500" :
                      e === "Police" ? "bg-dispatch-blue" : "bg-muted-foreground";
                    const Icon = e === "Fire" ? Flame : e === "Medical" ? HeartPulse : e === "Police" ? Shield : FolderOpen;
                    return (
                      <div key={e} className="flex items-center gap-2">
                        <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="w-14 text-[9px] font-mono uppercase text-muted-foreground">{e}</span>
                        <div className="flex-1 h-4 rounded bg-muted/50 overflow-hidden min-w-0">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.4 }}
                            className={`h-full rounded ${barColor}`}
                          />
                        </div>
                        <span className="w-5 text-right text-[10px] font-mono font-bold tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <Card className="glass-panel h-full flex flex-col min-h-0">
              <CardHeader className="py-1.5 px-3 flex-shrink-0">
                <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Status graph
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3 flex-1 min-h-0">
                <div className="flex flex-col gap-1.5">
                  {(["Open", "Dispatched", "Resolved", "Unfounded"] as const).map((s) => {
                    const count = statusDistribution.dist[s];
                    const pct = statusDistribution.max > 0 ? (count / statusDistribution.max) * 100 : 0;
                    const barColor =
                      s === "Open" ? "bg-dispatch-blue" :
                      s === "Dispatched" ? "bg-dispatch-amber" :
                      s === "Resolved" ? "bg-dispatch-green" : "bg-muted";
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className="w-16 text-[9px] font-mono uppercase text-muted-foreground">{s}</span>
                        <div className="flex-1 h-4 rounded bg-muted/50 overflow-hidden min-w-0">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.4 }}
                            className={`h-full rounded ${barColor}`}
                          />
                        </div>
                        <span className="w-5 text-right text-[10px] font-mono font-bold tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </div>
    </main>
  );

  if (embedded) {
    return mainContent;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background grid-bg">
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-panel border-b border-border/50 px-4 py-3"
      >
        <div className="flex items-center justify-between max-w-[1920px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="h-5 w-5 text-dispatch-cyan" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-dispatch-green animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-foreground uppercase">
                Incident Archive
              </h1>
              <p className="text-[9px] font-mono text-muted-foreground tracking-widest">
                AI-ASSISTED CASE HISTORY & STATUS QUEUE
              </p>
            </div>
            {firebaseCalls.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-dispatch-cyan/30 bg-dispatch-cyan/10 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-dispatch-cyan">
                <Database className="h-3 w-3" />
                Live from Firebase ({firebaseCalls.length} calls)
              </span>
            )}
            {firebaseLoading && (
              <span className="text-[9px] font-mono text-muted-foreground animate-pulse">Loading Firebase…</span>
            )}
            {firebaseError && (
              <span className="text-[9px] font-mono text-destructive">{firebaseError}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full border border-dispatch-cyan/30 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-dispatch-cyan bg-dispatch-cyan/10 hover:bg-dispatch-cyan/20 transition-colors"
            >
              <LayoutDashboard className="h-3 w-3" />
              Live View
            </Link>
          </div>
        </div>
      </motion.header>

      {mainContent}
    </div>
  );
}