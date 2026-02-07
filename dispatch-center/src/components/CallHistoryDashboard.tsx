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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

export function CallHistoryDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [emergencyFilter, setEmergencyFilter] = useState<EmergencyFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");

  const handleClear = () => {
    setStatusFilter("All");
    setPriorityFilter("All");
    setEmergencyFilter("All");
    setSearchTerm("");
  };

  const filteredCalls = useMemo(() => {
    return CALLS.filter((call) => {
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
  }, [statusFilter, priorityFilter, emergencyFilter, searchTerm]);

  const totals = useMemo(() => {
    return {
      open: CALLS.filter((call) => call.status === "Open").length,
      dispatched: CALLS.filter((call) => call.status === "Dispatched").length,
      resolved: CALLS.filter((call) => call.status === "Resolved").length,
      unfounded: CALLS.filter((call) => call.status === "Unfounded").length,
    };
  }, []);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background grid-bg">
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

      <main className="flex-1 px-4 pb-6 pt-4 max-w-[1920px] mx-auto w-full">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"
        >
          {[
            { label: "Open", value: totals.open, tone: "text-dispatch-blue" },
            { label: "Dispatched", value: totals.dispatched, tone: "text-dispatch-amber" },
            { label: "Resolved", value: totals.resolved, tone: "text-dispatch-green" },
            { label: "Unfounded", value: totals.unfounded, tone: "text-muted-foreground" },
          ].map((stat) => (
            <Card key={stat.label} className="glass-panel">
              <CardContent className="p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </motion.section>

        <Card className="glass-panel mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-mono"
                onClick={handleClear}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Priority
              </span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Emergency
              </span>
              <select
                value={emergencyFilter}
                onChange={(event) => setEmergencyFilter(event.target.value as EmergencyFilter)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono"
              >
                {EMERGENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Search
              </span>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Caller, location, summary..."
                  className="flex-1 bg-transparent text-xs font-mono outline-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-dispatch-cyan flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              Case Queue
            </CardTitle>
          </CardHeader>
          <Separator className="opacity-30" />
          <CardContent className="p-0">
            <div className="grid grid-cols-[120px_170px_140px_1fr_160px_130px_120px] gap-2 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border/50">
              <span>Priority</span>
              <span>Caller</span>
              <span>Emergency</span>
              <span>Summary</span>
              <span>Location</span>
              <span>Date/Time</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-border/40">
              {filteredCalls.map((call) => (
                <div
                  key={call.id}
                  className="grid grid-cols-[120px_170px_140px_1fr_160px_130px_120px] gap-2 px-4 py-3 text-xs hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className={priorityClass(call.priority)}>
                      {call.priority}
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {call.id}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{call.caller}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {call.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-foreground">
                    <MapPin className="h-3 w-3 text-dispatch-cyan" />
                    {call.emergency}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground">{call.summary}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {call.extras?.join(" • ") || "Future signal"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {call.location}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTimestamp(call.timestamp)}
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className={statusClass(call.status)}>
                      {call.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
