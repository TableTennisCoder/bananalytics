"use client";

import { useRef, useState, useEffect, useCallback, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";
import type { EventResult } from "@/types/events";

const TYPE_COLORS: Record<string, string> = {
  screen: "#3B82F6",
  track: "#FFD60A",
  identify: "#22C55E",
};

const NODE_W = 220;
const NODE_H = 82;
const GAP_X = 60;
const OFFSET_Y = 80;

function topProp(event: EventResult): string | null {
  const p = event.properties;
  if (!p || Object.keys(p).length === 0) return null;
  const [k, v] = Object.entries(p)[0];
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `${k}: ${s.length > 22 ? s.slice(0, 22) + "..." : s}`;
}

interface JourneyFlowProps {
  events: EventResult[];
  className?: string;
}

export function JourneyFlow({ events, className }: JourneyFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate positions
  const positions = sorted.map((_, i) => ({
    x: i * (NODE_W + GAP_X),
    y: i % 2 === 0 ? 0 : OFFSET_Y,
  }));

  const totalW = positions.length > 0 ? positions[positions.length - 1].x + NODE_W : 0;
  const totalH = OFFSET_Y + NODE_H;

  // Fit view on mount
  useEffect(() => {
    if (!containerRef.current || positions.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padX = 40;
    const padY = 60;
    // Show ~3-4 nodes at a comfortable zoom, user can pan to see the rest
    const visibleW = Math.min(totalW, (NODE_W + GAP_X) * 3.5);
    const scaleX = (rect.width - padX * 2) / visibleW;
    const scaleY = (rect.height - padY * 2) / totalH;
    const scale = Math.min(scaleX, scaleY, 1.2);
    const x = padX;
    const y = (rect.height - totalH * scale) / 2;
    setTransform({ x, y, scale });
  }, [positions.length, totalW, totalH]);

  // Pan
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform.x, transform.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setTransform((t) => ({
      ...t,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  }, [dragging]);

  const onPointerUp = useCallback(() => setDragging(false), []);

  // Zoom — native listener with passive:false to prevent page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((t) => {
        const newScale = Math.min(Math.max(t.scale * delta, 0.15), 2);
        const ratio = newScale / t.scale;
        return {
          scale: newScale,
          x: mouseX - (mouseX - t.x) * ratio,
          y: mouseY - (mouseY - t.y) * ratio,
        };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-[#0A0B0F] cursor-grab active:cursor-grabbing select-none ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {/* SVG edges */}
        <svg
          width={totalW}
          height={totalH}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
        >
          {positions.slice(1).map((pos, i) => {
            const prev = positions[i];
            const x1 = prev.x + NODE_W;
            const y1 = prev.y + NODE_H / 2;
            const x2 = pos.x;
            const y2 = pos.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;

            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#FFD60A"
                strokeWidth={2}
                opacity={0.3}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="20"
                  to="0"
                  dur="1s"
                  repeatCount="indefinite"
                />
                <set attributeName="stroke-dasharray" to="8 12" />
              </path>
            );
          })}
          {/* Static glow layer */}
          {positions.slice(1).map((pos, i) => {
            const prev = positions[i];
            const x1 = prev.x + NODE_W;
            const y1 = prev.y + NODE_H / 2;
            const x2 = pos.x;
            const y2 = pos.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;

            return (
              <path
                key={`glow-${i}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#FFD60A"
                strokeWidth={1}
                opacity={0.1}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {sorted.map((event, i) => {
          const pos = positions[i];
          const color = TYPE_COLORS[event.type] || "#FFD60A";
          const prop = topProp(event);

          return (
            <div
              key={event.id}
              data-node
              className="absolute rounded-lg border border-border bg-card p-3 shadow-lg transition-shadow hover:shadow-xl hover:border-primary/30"
              style={{
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                borderLeftWidth: 3,
                borderLeftColor: color,
              }}
            >
              {/* Connection dots */}
              {i > 0 && (
                <div
                  className="absolute -left-[5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {i < sorted.length - 1 && (
                <div
                  className="absolute -right-[5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}

              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-foreground truncate">{event.event}</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {event.type}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1">
                {formatRelative(event.timestamp)}
              </p>
              {prop && (
                <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{prop}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Step counter */}
      <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/40 font-mono">
        {sorted.length} events
      </div>
    </div>
  );
}
