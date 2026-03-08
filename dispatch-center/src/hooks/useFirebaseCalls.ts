"use client";

import { useState, useEffect } from "react";
import { onValue } from "firebase/database";
import { callsRef } from "@/lib/firebase";

export interface FirebaseCallMessage {
  role: string;
  text: string;
  timestamp?: string;
  mainConcern?: string | null;
  locationMentioned?: string | null;
  priority?: string | null;
  sentiment?: string | null;
  emotion?: string | null;
}

export interface FirebaseCall {
  callId: string;
  startTime: string;
  status: "active" | "ended";
  streamSid?: string | null;
  mainConcern?: string | null;
  locationToldByCaller?: string | null;
  priority?: string | null;
  summary?: string | null;
  endTime?: string | null;
  contactNumber?: string | null;
  messages?: Record<string, FirebaseCallMessage>;
}

function snapshotToCalls(snapshot: import("firebase/database").DataSnapshot): FirebaseCall[] {
  const val = snapshot.val();
  if (!val || typeof val !== "object") return [];
  return Object.entries(val).map(([id, data]) => {
    const d = data as Record<string, unknown>;
    return {
      callId: id,
      startTime: (d.startTime as string) ?? "",
      status: (d.status as "active" | "ended") ?? "ended",
      streamSid: (d.streamSid as string | null) ?? null,
      mainConcern: (d.mainConcern as string | null) ?? null,
      locationToldByCaller: (d.locationToldByCaller as string | null) ?? null,
      priority: (d.priority as string | null) ?? null,
      summary: (d.summary as string | null) ?? null,
      endTime: (d.endTime as string | null) ?? null,
      contactNumber: (d.contactNumber as string | null) ?? null,
      messages: (d.messages as Record<string, FirebaseCallMessage>) ?? undefined,
    };
  });
}

export function useFirebaseCalls() {
  const [calls, setCalls] = useState<FirebaseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let ref;
    try {
      ref = callsRef();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Firebase not configured");
      setLoading(false);
      return;
    }
    const unsub = onValue(
      ref!,
      (snapshot) => {
        setCalls(snapshotToCalls(snapshot));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setCalls([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Sort by startTime descending (newest first)
  const sortedCalls = [...calls].sort((a, b) => {
    const tA = new Date(a.startTime).getTime();
    const tB = new Date(b.startTime).getTime();
    return tB - tA;
  });

  const activeCalls = calls.filter((c) => c.status === "active");
  const endedCalls = calls.filter((c) => c.status === "ended");

  return {
    calls: sortedCalls,
    activeCalls,
    endedCalls,
    loading,
    error,
  };
}
