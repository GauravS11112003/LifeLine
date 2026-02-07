"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Activity } from "lucide-react";

interface AudioVisualizerProps {
  volume: number;
  isActive: boolean;
}

// ──── Waveform Canvas ────
function WaveformCanvas({ volume, isActive }: { volume: number; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const barsRef = useRef<number[]>(Array(64).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barCount = 64;
    const barWidth = width / barCount - 2;
    const bars = barsRef.current;

    ctx.clearRect(0, 0, width, height);

    // Draw center line
    ctx.strokeStyle = "rgba(37, 99, 235, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Update and draw bars
    for (let i = 0; i < barCount; i++) {
      const targetHeight =
        isActive && volume > 0
          ? (Math.sin(Date.now() * 0.003 + i * 0.4) * 0.5 + 0.5) *
            volume *
            height *
            0.8
          : 2;

      bars[i] += (targetHeight - bars[i]) * 0.15;

      const barHeight = Math.max(2, bars[i]);
      const x = i * (barWidth + 2) + 1;
      const y = (height - barHeight) / 2;

      // Gradient based on intensity
      const intensity = barHeight / height;
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);

      if (intensity > 0.6) {
        gradient.addColorStop(0, "rgba(220, 38, 38, 0.85)");
        gradient.addColorStop(0.5, "rgba(234, 88, 12, 0.7)");
        gradient.addColorStop(1, "rgba(220, 38, 38, 0.85)");
      } else if (intensity > 0.3) {
        gradient.addColorStop(0, "rgba(37, 99, 235, 0.8)");
        gradient.addColorStop(0.5, "rgba(14, 116, 144, 0.65)");
        gradient.addColorStop(1, "rgba(37, 99, 235, 0.8)");
      } else {
        gradient.addColorStop(0, "rgba(37, 99, 235, 0.4)");
        gradient.addColorStop(1, "rgba(37, 99, 235, 0.2)");
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Glow effect for high bars
      if (intensity > 0.4) {
        ctx.shadowColor = "rgba(37, 99, 235, 0.35)";
        ctx.shadowBlur = 6;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.shadowBlur = 0;
      }
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [volume, isActive]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

export function AudioVisualizer({
  volume,
  isActive,
}: AudioVisualizerProps) {
  return (
    <Card className="glass-panel h-full flex flex-col min-h-0">
      <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-dispatch-cyan text-xs">
            <Activity className="h-4 w-4" />
            Audio Waveform
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              VOL
            </span>
            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{
                  width: `${volume * 100}%`,
                  backgroundColor:
                    volume > 0.7
                      ? "#ef4444"
                      : volume > 0.4
                      ? "#06b6d4"
                      : "#3b82f6",
                }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-[10px] font-mono text-dispatch-cyan w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <Separator className="opacity-30" />
      <CardContent className="p-2 flex-1 min-h-0">
        <WaveformCanvas volume={volume} isActive={isActive} />
      </CardContent>
    </Card>
  );
}
