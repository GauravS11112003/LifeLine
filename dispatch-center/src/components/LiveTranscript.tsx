"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Radio, MessageSquare, Bot, AlertTriangle } from "lucide-react";
import type { TranscriptLine } from "@/hooks/useMockStream";

interface LiveTranscriptProps {
  lines: TranscriptLine[];
  isActive: boolean;
  callDuration: number;
}

function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setIsComplete(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!isComplete && <span className="typewriter-cursor" />}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SpeakerIcon({ speaker }: { speaker: string }) {
  switch (speaker) {
    case "CALLER":
      return <MessageSquare className="h-3.5 w-3.5" />;
    case "AI":
      return <Bot className="h-3.5 w-3.5" />;
    case "SYSTEM":
      return <AlertTriangle className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function speakerColor(speaker: string): string {
  switch (speaker) {
    case "CALLER":
      return "text-dispatch-red";
    case "AI":
      return "text-dispatch-blue";
    case "SYSTEM":
      return "text-dispatch-amber";
    default:
      return "text-foreground";
  }
}

function speakerBorderColor(speaker: string): string {
  switch (speaker) {
    case "CALLER":
      return "border-l-dispatch-red/50";
    case "AI":
      return "border-l-dispatch-blue/50";
    case "SYSTEM":
      return "border-l-dispatch-amber/50";
    default:
      return "border-l-border";
  }
}

export function LiveTranscript({
  lines,
  isActive,
  callDuration,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [lines]);

  return (
    <Card className="glass-panel h-full flex flex-col overflow-hidden relative min-h-0">
      {/* Scan line overlay */}
      <div className="scan-overlay absolute inset-0 pointer-events-none" />

      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-dispatch-cyan">
            <Radio className="h-4 w-4" />
            Live Transcript
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">
              {lines.length} LINES
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-xs font-mono text-dispatch-cyan">
              {formatDuration(callDuration)}
            </span>
            {isActive && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dispatch-red opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-dispatch-red" />
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <Separator className="opacity-30" />

      <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
        <ScrollArea ref={scrollRef} className="h-full">
          <div className="p-4 space-y-1">
            <AnimatePresence mode="popLayout">
              {lines.map((line, index) => {
                const isLatest = index === lines.length - 1;
                return (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    transition={{
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                    className={`border-l-2 pl-3 py-1.5 ${speakerBorderColor(
                      line.speaker
                    )}`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`${speakerColor(line.speaker)}`}>
                        <SpeakerIcon speaker={line.speaker} />
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-widest ${speakerColor(
                          line.speaker
                        )}`}
                      >
                        {line.speaker}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {line.timestamp}
                      </span>
                      {line.keywords.length > 0 && (
                        <span className="text-[9px] font-mono text-dispatch-amber bg-dispatch-amber/10 px-1.5 py-0.5 rounded-full uppercase">
                          {line.keywords.join(" · ")}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        line.speaker === "SYSTEM"
                          ? "font-mono text-[11px] text-dispatch-amber/80 tracking-wider"
                          : "text-foreground/90"
                      }`}
                    >
                      {isLatest ? (
                        <TypewriterText text={line.text} speed={15} />
                      ) : (
                        line.text
                      )}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {lines.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Radio className="h-8 w-8 mb-3 opacity-30 animate-pulse" />
                <p className="text-xs font-mono uppercase tracking-widest">
                  Awaiting incoming transmission...
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
