"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TranscriptLine, IntelData } from "./useMockStream";

// ── Keyword detection (shared with useMockStream) ──

const KEYWORD_MAP: Record<string, string[]> = {
  fire: ["fire", "burning", "flames", "smoke", "blaze"],
  injury: [
    "injured",
    "hurt",
    "bleeding",
    "unconscious",
    "injury",
    "burn",
    "burns",
  ],
  medical: ["ambulance", "medical", "paramedic", "breathing", "chest"],
  hazmat: ["chemical", "gas", "explosion", "hazardous"],
  rescue: ["trapped", "stuck", "collapse", "rescue"],
  robbery: ["robbery", "robbed", "stealing", "thief", "gun", "weapon"],
  kidnapping: ["kidnapped", "abducted", "taken", "missing child"],
  assault: ["assault", "attacked", "beaten", "fighting", "violence"],
};

function detectKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [category, words] of Object.entries(KEYWORD_MAP)) {
    if (words.some((w) => lower.includes(w))) {
      found.push(category);
    }
  }
  return found;
}

// ── Types ──

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface VoiceStreamEvent {
  type:
    | "connected"
    | "call_start"
    | "call_end"
    | "transcript"
    | "system"
    | "volume"
    | "intel";
  speaker?: "CALLER" | "AI" | "SYSTEM";
  text?: string;
  timestamp?: string;
  streamSid?: string;
  level?: number;
  duration?: number;
  data?: IntelData;
}

// ── Hook ──

// Default to localhost:5050 (matches the PORT in .env)
const VOICE_AGENT_WS =
  process.env.NEXT_PUBLIC_VOICE_AGENT_WS || "ws://localhost:5050/dashboard";

export function useVoiceStream(wsUrl: string = VOICE_AGENT_WS) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [detectedProtocols, setDetectedProtocols] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [intel, setIntel] = useState<IntelData | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineCountRef = useRef(0);
  const shouldConnectRef = useRef(false);

  const MAX_RECONNECT_DELAY_MS = 10000;
  const INITIAL_RECONNECT_DELAY_MS = 1000;

  // ── Connect ──
  const connect = useCallback(() => {
    shouldConnectRef.current = true;

    // Already connected or connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const data: VoiceStreamEvent = JSON.parse(event.data);

          switch (data.type) {
            case "connected":
              // Voice agent acknowledged us
              break;

            case "call_start":
              setIsActive(true);
              setCallDuration(0);
              setIntel(null);
              // Start call timer
              if (durationRef.current) clearInterval(durationRef.current);
              durationRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
              }, 1000);
              break;

            case "call_end":
              setIsActive(false);
              if (durationRef.current) clearInterval(durationRef.current);
              setVolume(0);
              break;

            case "transcript": {
              const speaker = data.speaker || "CALLER";
              const text = data.text || "";
              const keywords = detectKeywords(text);
              const lineId = `live-${lineCountRef.current++}-${Date.now()}`;

              // Handle SYSTEM messages from backend
              const finalSpeaker = speaker === "SYSTEM" ? "SYSTEM" : speaker;

              const newLine: TranscriptLine = {
                id: lineId,
                speaker: finalSpeaker as "CALLER" | "AI" | "SYSTEM",
                text,
                timestamp: new Date(
                  data.timestamp || Date.now()
                ).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                keywords: finalSpeaker === "SYSTEM" ? [] : keywords,
              };

              // Deduplicate: skip if the last line has the same speaker + text
              setLines((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === newLine.speaker && last.text === newLine.text) {
                  return prev;
                }
                return [...prev, newLine];
              });

              if (keywords.length > 0 && finalSpeaker !== "SYSTEM") {
                setDetectedProtocols((prev) => {
                  const unique = new Set([...prev, ...keywords]);
                  return Array.from(unique);
                });
              }
              break;
            }

            case "system": {
              const sysId = `sys-${lineCountRef.current++}-${Date.now()}`;
              const sysLine: TranscriptLine = {
                id: sysId,
                speaker: "SYSTEM",
                text: data.text || "",
                timestamp: new Date(
                  data.timestamp || Date.now()
                ).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                keywords: [],
              };
              setLines((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === "SYSTEM" && last.text === sysLine.text) {
                  return prev;
                }
                return [...prev, sysLine];
              });
              break;
            }

            case "volume":
              setVolume(data.level || 0);
              break;

            case "intel":
              if (data.data) {
                setIntel(data.data);
                // Also update detected protocols from intel
                if (data.data.protocols && data.data.protocols.length > 0) {
                  const protocolIds = data.data.protocols.map((p) => p.id);
                  setDetectedProtocols((prev) => {
                    const unique = new Set([...prev, ...protocolIds]);
                    return Array.from(unique);
                  });
                }
              }
              break;
          }
        } catch (err) {
          console.error("Failed to parse voice stream message:", err);
        }
      };

      ws.onclose = () => {
        // If a newer socket replaced this one (e.g. Strict Mode remount),
        // ignore the stale close to avoid clobbering the active connection.
        if (wsRef.current !== ws) return;

        setConnectionStatus("disconnected");
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (shouldConnectRef.current) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY_MS
          );
          reconnectAttemptRef.current += 1;
          reconnectRef.current = setTimeout(() => {
            reconnectRef.current = null;
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // Ignore errors from stale sockets
        if (wsRef.current !== ws) return;
        setConnectionStatus("error");
      };
    } catch {
      setConnectionStatus("error");
    }
  }, [wsUrl]);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    reconnectAttemptRef.current = 0;

    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus("disconnected");
    setIsActive(false);
    setVolume(0);
  }, []);

  // ── Reset (clear displayed data, keep connection) ──
  const reset = useCallback(() => {
    setLines([]);
    setDetectedProtocols([]);
    setCallDuration(0);
    setVolume(0);
    setIntel(null);
    lineCountRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldConnectRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (durationRef.current) clearInterval(durationRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
    // Same interface as useMockStream
    lines,
    isActive,
    volume,
    callDuration,
    currentIndex: lines.length,
    totalLines: lines.length,
    detectedProtocols,
    isComplete: false, // live stream doesn't "complete"
    intel,
    reset,
    togglePause: () => {}, // not applicable for live calls

    // Live-specific
    connectionStatus,
    connect,
    disconnect,
  };
}
