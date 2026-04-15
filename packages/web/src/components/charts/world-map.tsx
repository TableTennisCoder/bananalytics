"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import type { GeoData } from "@/types/geo";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO 3166-1 numeric → alpha-2 mapping for matching
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "AF", "008": "AL", "012": "DZ", "020": "AD", "024": "AO", "028": "AG",
  "032": "AR", "051": "AM", "036": "AU", "040": "AT", "031": "AZ", "044": "BS",
  "048": "BH", "050": "BD", "052": "BB", "112": "BY", "056": "BE", "084": "BZ",
  "204": "BJ", "064": "BT", "068": "BO", "070": "BA", "072": "BW", "076": "BR",
  "096": "BN", "100": "BG", "854": "BF", "108": "BI", "116": "KH", "120": "CM",
  "124": "CA", "132": "CV", "140": "CF", "148": "TD", "152": "CL", "156": "CN",
  "170": "CO", "174": "KM", "178": "CG", "180": "CD", "188": "CR", "384": "CI",
  "191": "HR", "192": "CU", "196": "CY", "203": "CZ", "208": "DK", "262": "DJ",
  "212": "DM", "214": "DO", "218": "EC", "818": "EG", "222": "SV", "226": "GQ",
  "232": "ER", "233": "EE", "231": "ET", "242": "FJ", "246": "FI", "250": "FR",
  "266": "GA", "270": "GM", "268": "GE", "276": "DE", "288": "GH", "300": "GR",
  "308": "GD", "320": "GT", "324": "GN", "624": "GW", "328": "GY", "332": "HT",
  "340": "HN", "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR",
  "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "388": "JM", "392": "JP",
  "400": "JO", "398": "KZ", "404": "KE", "296": "KI", "408": "KP", "410": "KR",
  "414": "KW", "417": "KG", "418": "LA", "428": "LV", "422": "LB", "426": "LS",
  "430": "LR", "434": "LY", "440": "LT", "442": "LU", "807": "MK", "450": "MG",
  "454": "MW", "458": "MY", "462": "MV", "466": "ML", "470": "MT", "478": "MR",
  "480": "MU", "484": "MX", "498": "MD", "496": "MN", "499": "ME", "504": "MA",
  "508": "MZ", "104": "MM", "516": "NA", "524": "NP", "528": "NL", "554": "NZ",
  "558": "NI", "562": "NE", "566": "NG", "578": "NO", "512": "OM", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH", "616": "PL",
  "620": "PT", "634": "QA", "642": "RO", "643": "RU", "646": "RW", "659": "KN",
  "662": "LC", "670": "VC", "882": "WS", "678": "ST", "682": "SA", "686": "SN",
  "688": "RS", "690": "SC", "694": "SL", "702": "SG", "703": "SK", "705": "SI",
  "090": "SB", "706": "SO", "710": "ZA", "724": "ES", "144": "LK", "736": "SD",
  "740": "SR", "748": "SZ", "752": "SE", "756": "CH", "760": "SY", "762": "TJ",
  "834": "TZ", "764": "TH", "626": "TL", "768": "TG", "776": "TO", "780": "TT",
  "788": "TN", "792": "TR", "795": "TM", "800": "UG", "804": "UA", "784": "AE",
  "826": "GB", "840": "US", "858": "UY", "860": "UZ", "548": "VU", "862": "VE",
  "704": "VN", "887": "YE", "894": "ZM", "716": "ZW",
  "-99": "XX", "010": "AQ",
};

interface WorldMapProps {
  data: GeoData[];
  className?: string;
}

export function WorldMap({ data, className }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const countryMap = useMemo(() => {
    const map = new Map<string, GeoData>();
    for (const d of data) {
      if (d.country_code) map.set(d.country_code.toUpperCase(), d);
    }
    return map;
  }, [data]);

  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  // Pan
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [transform.x, transform.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setTooltip(null);
    setTransform((t) => ({
      ...t,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  }, [dragging]);

  const onPointerUp = useCallback(() => setDragging(false), []);

  // Zoom via scroll — native listener with passive:false to prevent page scroll
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
        const newScale = Math.min(Math.max(t.scale * delta, 0.5), 6);
        const ratio = newScale / t.scale;
        return { scale: newScale, x: mouseX - (mouseX - t.x) * ratio, y: mouseY - (mouseY - t.y) * ratio };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Zoom buttons
  const zoomIn = useCallback(() => {
    setTransform((t) => {
      const newScale = Math.min(t.scale * 1.3, 6);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = newScale / t.scale;
      return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => {
      const newScale = Math.max(t.scale / 1.3, 0.5);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = newScale / t.scale;
      return { scale: newScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden cursor-grab active:cursor-grabbing select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
        }}
      >
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 220 }}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericCode = geo.id;
                const alpha2 = NUMERIC_TO_ALPHA2[numericCode] || "";
                const geoData = countryMap.get(alpha2);
                const count = geoData?.count ?? 0;
                const intensity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(e) => {
                      if (dragging) return;
                      const name = geo.properties.name || "Unknown";
                      setTooltip({ name, count: geoData?.unique_users ?? 0, x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      if (dragging) return;
                      setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill: count > 0 ? `rgba(255, 214, 10, ${intensity})` : "#1A1B21",
                        stroke: "#2A2B33",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: count > 0 ? `rgba(255, 214, 10, ${Math.min(intensity + 0.2, 1)})` : "#252630",
                        stroke: "#FFD60A",
                        strokeWidth: 0.8,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        fill: `rgba(255, 214, 10, ${Math.min(intensity + 0.3, 1)})`,
                        stroke: "#FFD60A",
                        strokeWidth: 0.8,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <button onClick={zoomIn} className="flex h-7 w-7 items-center justify-center rounded-md bg-card border border-border text-foreground hover:bg-muted transition-colors">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button onClick={zoomOut} className="flex h-7 w-7 items-center justify-center rounded-md bg-card border border-border text-foreground hover:bg-muted transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <span className="font-medium">{tooltip.name}</span>
          {tooltip.count > 0 && (
            <span className="text-primary ml-1.5">{tooltip.count.toLocaleString()} visitors</span>
          )}
        </div>
      )}
    </div>
  );
}
