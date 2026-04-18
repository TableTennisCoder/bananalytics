"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GeoData } from "@/types/geo";

// Dynamic import to avoid SSR issues with WebGL
let GlobeModule: typeof import("react-globe.gl") | null = null;

interface GlobeProps {
  data: GeoData[];
  className?: string;
}

interface PointData {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  count: number;
}

export function AnalyticsGlobe({ data, className }: GlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [GlobeComponent, setGlobeComponent] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Load Globe dynamically (client-side only)
  useEffect(() => {
    import("react-globe.gl").then((mod) => {
      setGlobeComponent(() => mod.default);
    });
  }, []);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = true;
      controls.minDistance = 200;
      controls.maxDistance = 500;
    }
  }, [GlobeComponent]);

  // Set initial point of view
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 30, lng: 10, altitude: 2.2 }, 1000);
  }, [GlobeComponent]);

  // Transform geo data to globe points
  const points: PointData[] = data
    .filter((d) => d.lat !== 0 || d.lng !== 0)
    .map((d) => {
      const maxCount = Math.max(...data.map((g) => g.count), 1);
      const normalized = d.count / maxCount;
      return {
        lat: d.lat,
        lng: d.lng,
        size: 0.3 + normalized * 1.2,
        color: "#D87757",
        label: `${d.country}${d.city ? ` · ${d.city}` : ""}: ${d.count} events`,
        count: d.count,
      };
    });

  const pointAltitude = useCallback((d: object) => (d as PointData).size * 0.01, []);
  const pointRadius = useCallback((d: object) => (d as PointData).size * 0.4, []);
  const pointColor = useCallback((d: object) => (d as PointData).color, []);
  const pointLabel = useCallback((d: object) => {
    const p = d as PointData;
    return `<div style="background:#1B1B1B;color:#FAF9F1;padding:6px 10px;border-radius:6px;font-size:12px;border:1px solid #3D3D3D">
      <strong>${p.label}</strong>
    </div>`;
  }, []);

  if (!GlobeComponent) {
    return (
      <div ref={containerRef} className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading globe...
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {dimensions.width > 0 && (
        <GlobeComponent
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#D87757"
          atmosphereAltitude={0.15}
          pointsData={points}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointColor={pointColor}
          pointLabel={pointLabel}
          pointsMerge={false}
          animateIn={true}
        />
      )}
    </div>
  );
}
