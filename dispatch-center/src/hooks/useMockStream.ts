"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface TranscriptLine {
  id: string;
  speaker: "CALLER" | "AI" | "SYSTEM";
  text: string;
  timestamp: string;
  keywords: string[];
}

// ── Intel Data Types (shared across hooks) ──

export interface IntelLocation {
  address: string;
  lat: number;
  lng: number;
  sector: string;
}

export interface IntelProtocol {
  id: string;
  label: string;
  description: string;
  priority: "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface IntelResource {
  id: string;
  type: "Police" | "EMS" | "Fire" | "HazMat" | "Special";
  unit: string;
  status: "Dispatched" | "En Route" | "On Scene" | "Staged";
  eta: number | null;
}

export interface IntelData {
  incidentType: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  location: IntelLocation | null;
  protocols: IntelProtocol[];
  resources: IntelResource[];
  summary: string;
}

const KEYWORD_MAP: Record<string, string[]> = {
  fire: ["fire", "burning", "flames", "smoke", "blaze"],
  injury: ["injured", "hurt", "bleeding", "unconscious", "injury", "burn", "burns"],
  medical: ["ambulance", "medical", "paramedic", "breathing", "chest"],
  hazmat: ["chemical", "gas", "explosion", "hazardous"],
  rescue: ["trapped", "stuck", "collapse", "rescue"],
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

function getTimestamp(offsetSeconds: number): string {
  const now = new Date();
  now.setSeconds(now.getSeconds() + offsetSeconds);
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const MOCK_CALL: Array<{ speaker: "CALLER" | "AI" | "SYSTEM"; text: string }> = [
  { speaker: "SYSTEM", text: "── INCOMING 911 CALL ── LINE 7 ── PRIORITY: UNKNOWN ──" },
  { speaker: "AI", text: "911, what is your emergency?" },
  { speaker: "CALLER", text: "There's a fire! My neighbor's house is on fire!" },
  { speaker: "AI", text: "I'm dispatching fire units now. Can you tell me the address?" },
  { speaker: "CALLER", text: "It's 742 Evergreen Terrace, the two-story house on the corner." },
  { speaker: "AI", text: "742 Evergreen Terrace confirmed. Are there people inside the building?" },
  { speaker: "CALLER", text: "I think so! I saw someone at the window. They might be trapped!" },
  { speaker: "SYSTEM", text: "── PRIORITY ESCALATED: CRITICAL ── RESCUE PROTOCOL ACTIVATED ──" },
  { speaker: "AI", text: "Rescue units are being dispatched. Is anyone injured that you can see?" },
  { speaker: "CALLER", text: "The flames are coming from the kitchen. There's heavy smoke everywhere. I think someone is hurt — I heard screaming." },
  { speaker: "AI", text: "EMS is en route. Please stay clear of the building. Do not attempt to enter." },
  { speaker: "CALLER", text: "There are two kids in there! The parents came out but the kids are still inside!" },
  { speaker: "SYSTEM", text: "── LADDER COMPANY 7 DISPATCHED ── ETA 4 MIN ──" },
  { speaker: "AI", text: "Ladder company is en route. Can you tell me which floor the children might be on?" },
  { speaker: "CALLER", text: "Second floor! The bedrooms are on the second floor! Oh God, the roof is starting to collapse!" },
  { speaker: "AI", text: "Stay on the line. All units are aware of structural compromise. Keep everyone at a safe distance." },
  { speaker: "SYSTEM", text: "── STRUCTURE INTEGRITY: COMPROMISED ── HAZMAT ADVISORY ISSUED ──" },
  { speaker: "CALLER", text: "The fire trucks are here! I can see them! They're setting up ladders now." },
  { speaker: "AI", text: "Good. Fire units are on scene. Stay back and let them work. Is there any chemical storage or gas lines near the house?" },
  { speaker: "CALLER", text: "There's a gas meter on the side of the house! Oh no, I can smell gas!" },
  { speaker: "SYSTEM", text: "── GAS LEAK DETECTED ── EVACUATION PERIMETER: 200M ──" },
  { speaker: "AI", text: "Gas company has been notified. Please move to at least 200 meters away immediately." },
  { speaker: "CALLER", text: "They got one of the kids out! The firefighters have one child! They're going back in for the other one." },
  { speaker: "AI", text: "Confirmed. EMS is standing by for medical evaluation. Stay on the line." },
  { speaker: "CALLER", text: "They have both kids! They're both out! The paramedics are checking them now. One has burns on their arms." },
  { speaker: "SYSTEM", text: "── ALL OCCUPANTS EVACUATED ── BURN PROTOCOL ACTIVATED ── PEDIATRIC UNIT EN ROUTE ──" },
  { speaker: "AI", text: "Both children are safe. Burn unit and pediatric specialists are being dispatched to your location. You did the right thing calling." },
];

const ADDRESS_REQUEST_INDEX = 3;

// ── Progressive Mock Intel Snapshots ──
// Each entry is keyed by the transcript index at which it becomes active.
// As the call progresses, intel gets richer.
const MOCK_INTEL_SNAPSHOTS: Array<{ afterIndex: number; intel: IntelData }> = [
  {
    afterIndex: 2, // After "There's a fire!"
    intel: {
      incidentType: "Structure Fire",
      priority: "HIGH",
      location: null,
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Structure fire reported by neighbor. Awaiting address confirmation.",
          priority: "HIGH",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "Dispatched", eta: 360 },
        { id: "r4", type: "Police", unit: "Unit 42", status: "Dispatched", eta: 300 },
      ],
      summary: "Structure fire reported. Location pending confirmation.",
    },
  },
  {
    afterIndex: 4, // After address given: "742 Evergreen Terrace"
    intel: {
      incidentType: "Structure Fire",
      priority: "HIGH",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Structure fire confirmed at 742 Evergreen Terrace. Two-story residential on corner lot.",
          priority: "HIGH",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "En Route", eta: 280 },
        { id: "r4", type: "Police", unit: "Unit 42", status: "En Route", eta: 240 },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "Dispatched", eta: 360 },
      ],
      summary: "Structure fire at 742 Evergreen Terrace. Engine and patrol dispatched.",
    },
  },
  {
    afterIndex: 6, // After "someone at the window, trapped"
    intel: {
      incidentType: "Structure Fire / Rescue",
      priority: "CRITICAL",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Active structure fire at 742 Evergreen Terrace. Two-story residential.",
          priority: "CRITICAL",
        },
        {
          id: "rescue",
          label: "Rescue Ops",
          description: "Person reported at window, possibly trapped. Search & rescue required.",
          priority: "CRITICAL",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "En Route", eta: 200 },
        { id: "r2", type: "Fire", unit: "Ladder 12", status: "Dispatched", eta: 360 },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "En Route", eta: 280 },
        { id: "r4", type: "Police", unit: "Unit 42", status: "En Route", eta: 160 },
      ],
      summary: "Critical — person possibly trapped in structure fire at 742 Evergreen Terrace. Rescue ops initiated.",
    },
  },
  {
    afterIndex: 9, // After "flames from kitchen, someone hurt, screaming"
    intel: {
      incidentType: "Structure Fire / Rescue / Medical",
      priority: "CRITICAL",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Kitchen-origin fire engulfing structure. Heavy smoke reported.",
          priority: "CRITICAL",
        },
        {
          id: "rescue",
          label: "Rescue Ops",
          description: "Person at window trapped. Screaming heard — possible injuries.",
          priority: "CRITICAL",
        },
        {
          id: "injury",
          label: "Burn Protocol",
          description: "Burn injuries suspected. Trauma response required.",
          priority: "CRITICAL",
        },
        {
          id: "medical",
          label: "EMS Priority",
          description: "Medical emergency — screaming heard, possible burn victims.",
          priority: "HIGH",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "En Route", eta: 120 },
        { id: "r2", type: "Fire", unit: "Ladder 12", status: "En Route", eta: 280 },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "En Route", eta: 200 },
        { id: "r4", type: "Police", unit: "Unit 42", status: "On Scene", eta: null },
        { id: "r6", type: "Police", unit: "Unit 19", status: "En Route", eta: 180 },
      ],
      summary: "Multi-protocol critical incident. Kitchen fire, persons trapped, injuries suspected at 742 Evergreen Terrace.",
    },
  },
  {
    afterIndex: 11, // After "two kids inside, parents out"
    intel: {
      incidentType: "Structure Fire / Child Rescue",
      priority: "CRITICAL",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Active structure fire. Kitchen origin, spreading to upper floors.",
          priority: "CRITICAL",
        },
        {
          id: "rescue",
          label: "Child Rescue Ops",
          description: "2 children trapped on second floor. Parents evacuated safely.",
          priority: "CRITICAL",
        },
        {
          id: "injury",
          label: "Burn Protocol",
          description: "Potential burn injuries to trapped occupants. Burn unit on standby.",
          priority: "CRITICAL",
        },
        {
          id: "medical",
          label: "Pediatric EMS",
          description: "Pediatric patients — 2 minors trapped. Child-specific medical staging.",
          priority: "CRITICAL",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "On Scene", eta: null },
        { id: "r2", type: "Fire", unit: "Ladder 12", status: "En Route", eta: 180 },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "En Route", eta: 120 },
        { id: "r4", type: "Police", unit: "Unit 42", status: "On Scene", eta: null },
        { id: "r5", type: "EMS", unit: "Burn Unit", status: "Dispatched", eta: 480 },
        { id: "r6", type: "Police", unit: "Unit 19", status: "En Route", eta: 100 },
      ],
      summary: "CRITICAL — 2 children trapped on 2nd floor of burning structure. All available units responding.",
    },
  },
  {
    afterIndex: 14, // After "roof collapsing"
    intel: {
      incidentType: "Structure Fire / Collapse / Child Rescue",
      priority: "CRITICAL",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Active structure fire with roof collapse imminent. All hands.",
          priority: "CRITICAL",
        },
        {
          id: "rescue",
          label: "Child Rescue Ops",
          description: "2 children trapped — 2nd floor bedrooms. Structural integrity compromised.",
          priority: "CRITICAL",
        },
        {
          id: "injury",
          label: "Burn Protocol",
          description: "Burn injuries expected. Trauma team and burn unit alerted.",
          priority: "CRITICAL",
        },
        {
          id: "hazmat",
          label: "HazMat Advisory",
          description: "Structure compromise may expose utilities. Gas line risk elevated.",
          priority: "HIGH",
        },
        {
          id: "medical",
          label: "Pediatric EMS",
          description: "Pediatric patients at risk. Multiple ambulances staged.",
          priority: "CRITICAL",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "On Scene", eta: null },
        { id: "r2", type: "Fire", unit: "Ladder 12", status: "On Scene", eta: null },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "On Scene", eta: null },
        { id: "r4", type: "Police", unit: "Unit 42", status: "On Scene", eta: null },
        { id: "r5", type: "EMS", unit: "Burn Unit", status: "En Route", eta: 360 },
        { id: "r6", type: "Police", unit: "Unit 19", status: "On Scene", eta: null },
        { id: "r7", type: "Special", unit: "Struct. Eng.", status: "Dispatched", eta: 600 },
      ],
      summary: "CRITICAL — Structure fire with roof collapse. 2 children trapped on 2nd floor. All protocols active.",
    },
  },
  {
    afterIndex: 18, // After gas smell detected
    intel: {
      incidentType: "Structure Fire / Gas Leak / Child Rescue",
      priority: "CRITICAL",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Protocol",
          description: "Active structure fire with partial roof collapse. Suppression ongoing.",
          priority: "CRITICAL",
        },
        {
          id: "rescue",
          label: "Child Rescue Ops",
          description: "Active rescue of 2 children. Ladder company performing extraction.",
          priority: "CRITICAL",
        },
        {
          id: "hazmat",
          label: "Gas Leak — HazMat",
          description: "Gas odor confirmed near structure. Gas meter on exterior wall compromised. 200m evacuation.",
          priority: "CRITICAL",
        },
        {
          id: "injury",
          label: "Burn Protocol",
          description: "Burn injuries anticipated. Burn unit en route.",
          priority: "CRITICAL",
        },
        {
          id: "medical",
          label: "Pediatric EMS",
          description: "Multiple pediatric patients. Mass casualty staging prepared.",
          priority: "CRITICAL",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "On Scene", eta: null },
        { id: "r2", type: "Fire", unit: "Ladder 12", status: "On Scene", eta: null },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "On Scene", eta: null },
        { id: "r4", type: "Police", unit: "Unit 42", status: "On Scene", eta: null },
        { id: "r5", type: "EMS", unit: "Burn Unit", status: "En Route", eta: 240 },
        { id: "r6", type: "Police", unit: "Unit 19", status: "On Scene", eta: null },
        { id: "r7", type: "Special", unit: "Struct. Eng.", status: "En Route", eta: 480 },
        { id: "r8", type: "HazMat", unit: "HazMat 1", status: "Dispatched", eta: 420 },
      ],
      summary: "CRITICAL — Multi-hazard incident: structure fire, gas leak, 2 children trapped. 200m evacuation ordered.",
    },
  },
  {
    afterIndex: 23, // After kids rescued, burns on arms
    intel: {
      incidentType: "Structure Fire / Gas Leak / Mass Casualty",
      priority: "CRITICAL",
      location: { address: "742 EVERGREEN TERRACE, SPRINGFIELD, IL, USA", lat: 39.7817, lng: -89.6501, sector: "SECTOR 4-D" },
      protocols: [
        {
          id: "fire",
          label: "Fire Suppression",
          description: "Active suppression. Roof partially collapsed. Fire contained to structure.",
          priority: "CRITICAL",
        },
        {
          id: "rescue",
          label: "Rescue Complete",
          description: "All occupants evacuated. 2 children extracted by Ladder 12.",
          priority: "HIGH",
        },
        {
          id: "hazmat",
          label: "Gas Leak — HazMat",
          description: "Gas company notified. HazMat team en route. 200m perimeter enforced.",
          priority: "CRITICAL",
        },
        {
          id: "injury",
          label: "Burn Protocol — Active",
          description: "1 child with arm burns confirmed. Burn unit and pediatric specialists dispatched.",
          priority: "CRITICAL",
        },
        {
          id: "medical",
          label: "Pediatric Trauma",
          description: "2 pediatric patients being evaluated. Smoke inhalation + burns. Transport to children's hospital.",
          priority: "CRITICAL",
        },
      ],
      resources: [
        { id: "r1", type: "Fire", unit: "Engine 7", status: "On Scene", eta: null },
        { id: "r2", type: "Fire", unit: "Ladder 12", status: "On Scene", eta: null },
        { id: "r3", type: "EMS", unit: "Medic 3", status: "On Scene", eta: null },
        { id: "r4", type: "Police", unit: "Unit 42", status: "On Scene", eta: null },
        { id: "r5", type: "EMS", unit: "Burn Unit", status: "En Route", eta: 120 },
        { id: "r6", type: "Police", unit: "Unit 19", status: "On Scene", eta: null },
        { id: "r7", type: "Special", unit: "Struct. Eng.", status: "En Route", eta: 300 },
        { id: "r8", type: "HazMat", unit: "HazMat 1", status: "En Route", eta: 300 },
        { id: "r9", type: "EMS", unit: "Peds Unit", status: "Dispatched", eta: 480 },
      ],
      summary: "All occupants evacuated. 1 child has burn injuries. Gas leak active — HazMat and pediatric trauma units responding.",
    },
  },
];

export function useMockStream(intervalMs: number = 2000) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detectedProtocols, setDetectedProtocols] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [intel, setIntel] = useState<IntelData | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  const streamingIndexRef = useRef(0);

  // Simulate volume changes
  useEffect(() => {
    const volumeInterval = setInterval(() => {
      if (isActive && currentIndex < MOCK_CALL.length) {
        setVolume(Math.random() * 0.7 + 0.3);
      } else {
        setVolume(0);
      }
    }, 200);

    return () => clearInterval(volumeInterval);
  }, [isActive, currentIndex]);

  // Call duration timer
  useEffect(() => {
    if (isActive) {
      durationRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [isActive]);

  // Update intel based on current transcript index
  useEffect(() => {
    // Find the latest applicable intel snapshot
    let latestIntel: IntelData | null = null;
    for (const snapshot of MOCK_INTEL_SNAPSHOTS) {
      if (currentIndex >= snapshot.afterIndex) {
        latestIntel = snapshot.intel;
      }
    }
    if (latestIntel) {
      setIntel(latestIntel);
    }
  }, [currentIndex]);

  // Stream transcript lines (ref-based index so Strict Mode double-invoke doesn't add duplicates)
  useEffect(() => {
    if (!isActive || streamingIndexRef.current >= MOCK_CALL.length) return;

    timerRef.current = setTimeout(() => {
      const idx = streamingIndexRef.current;
      if (idx >= MOCK_CALL.length) return;

      const entry = MOCK_CALL[idx];
      const keywords = detectKeywords(entry.text);
      const newLine: TranscriptLine = {
        id: `line-${idx}-${Date.now()}`,
        speaker: entry.speaker,
        text: entry.text,
        timestamp: getTimestamp(0),
        keywords,
      };

      streamingIndexRef.current = idx + 1;
      setLines((prev) =>
        prev.some((l) => l.id === newLine.id) ? prev : [...prev, newLine]
      );
      setCurrentIndex(streamingIndexRef.current);

      if (keywords.length > 0) {
        setDetectedProtocols((prev) => {
          const unique = new Set([...prev, ...keywords]);
          return Array.from(unique);
        });
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, intervalMs, lines.length]);

  const reset = useCallback(() => {
    streamingIndexRef.current = 0;
    setLines([]);
    setCurrentIndex(0);
    setDetectedProtocols([]);
    setCallDuration(0);
    setVolume(0);
    setIntel(null);
    setIsActive(true);
  }, []);

  const togglePause = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const addressRequested = currentIndex >= ADDRESS_REQUEST_INDEX + 1;

  return {
    lines,
    isActive,
    volume,
    callDuration,
    currentIndex,
    totalLines: MOCK_CALL.length,
    detectedProtocols,
    isComplete: currentIndex >= MOCK_CALL.length,
    intel,
    addressRequested,
    reset,
    togglePause,
  };
}