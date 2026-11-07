export type TuneId =
  | 'soft-chime'
  | 'crystal-bell'
  | 'warm-harmony'
  | 'digital-pulse'
  | 'gentle-sunrise'
  | 'none'

export interface TuneDefinition {
  id: TuneId
  name: string
  character: string
  durationSec: number
}

export const TUNE_REGISTRY: Record<TuneId, TuneDefinition> = {
  'soft-chime': {
    id: 'soft-chime',
    name: 'Soft Chime',
    character: 'Gentle, minimal two-note notification',
    durationSec: 1.1,
  },
  'crystal-bell': {
    id: 'crystal-bell',
    name: 'Crystal Bell',
    character: 'Clear, sparkling bell-like melody',
    durationSec: 1.7,
  },
  'warm-harmony': {
    id: 'warm-harmony',
    name: 'Warm Harmony',
    character: 'Soft, warm three-note ascending melody',
    durationSec: 1.6,
  },
  'digital-pulse': {
    id: 'digital-pulse',
    name: 'Digital Pulse',
    character: 'Modern, crisp electronic notification',
    durationSec: 0.65,
  },
  'gentle-sunrise': {
    id: 'gentle-sunrise',
    name: 'Gentle Sunrise',
    character: 'Calm, uplifting four-note melody',
    durationSec: 2.2,
  },
  none: {
    id: 'none',
    name: 'None — No Sound',
    character: 'Mute session completion',
    durationSec: 0,
  },
}

export const SUPPORTED_TUNE_IDS: readonly TuneId[] = [
  'soft-chime',
  'crystal-bell',
  'warm-harmony',
  'digital-pulse',
  'gentle-sunrise',
  'none',
]

export const DEFAULT_TUNE_ID: TuneId = 'soft-chime'

export function isTuneId(value: unknown): value is TuneId {
  return typeof value === 'string' && value in TUNE_REGISTRY
}

export interface ToneStep {
  freq: number
  startTime: number // offset in seconds from trigger
  duration: number  // duration in seconds
  gain: number      // relative amplitude (0.0 to 1.0)
  type?: OscillatorType // 'sine' | 'triangle' | 'square' | 'sawtooth'
  attack?: number   // attack time in seconds
  decay?: number    // decay time in seconds
}

// Synthesis definitions for Web Audio API
export const TUNE_SYNTHESIS_PATTERNS: Record<TuneId, ToneStep[]> = {
  'soft-chime': [
    // Gentle, minimal two-note chime (G4 -> C5)
    { freq: 392.0, startTime: 0.0, duration: 0.65, gain: 0.38, type: 'sine', attack: 0.018, decay: 0.6 },
    { freq: 784.0, startTime: 0.0, duration: 0.35, gain: 0.07, type: 'sine', attack: 0.015, decay: 0.3 },
    { freq: 523.25, startTime: 0.22, duration: 0.85, gain: 0.42, type: 'sine', attack: 0.018, decay: 0.8 },
    { freq: 1046.5, startTime: 0.22, duration: 0.45, gain: 0.08, type: 'sine', attack: 0.015, decay: 0.4 },
  ],
  'crystal-bell': [
    // Sparkling bell melody (E5 -> B5 -> E6) with crystal-like overtones
    { freq: 659.25, startTime: 0.0, duration: 0.7, gain: 0.32, type: 'sine', attack: 0.005, decay: 0.65 },
    { freq: 1819.5, startTime: 0.0, duration: 0.25, gain: 0.1, type: 'sine', attack: 0.003, decay: 0.22 },
    { freq: 987.77, startTime: 0.16, duration: 0.75, gain: 0.34, type: 'sine', attack: 0.005, decay: 0.7 },
    { freq: 2726.2, startTime: 0.16, duration: 0.25, gain: 0.1, type: 'sine', attack: 0.003, decay: 0.22 },
    { freq: 1318.51, startTime: 0.34, duration: 1.3, gain: 0.38, type: 'sine', attack: 0.005, decay: 1.25 },
    { freq: 2637.02, startTime: 0.34, duration: 0.45, gain: 0.12, type: 'sine', attack: 0.003, decay: 0.4 },
  ],
  'warm-harmony': [
    // Soft, warm three-note ascending triad (D4 -> F#4 -> A4)
    { freq: 293.66, startTime: 0.0, duration: 0.75, gain: 0.32, type: 'triangle', attack: 0.03, decay: 0.65 },
    { freq: 146.83, startTime: 0.0, duration: 0.55, gain: 0.12, type: 'sine', attack: 0.03, decay: 0.5 },
    { freq: 369.99, startTime: 0.2, duration: 0.75, gain: 0.34, type: 'triangle', attack: 0.03, decay: 0.65 },
    { freq: 440.0, startTime: 0.4, duration: 1.15, gain: 0.38, type: 'triangle', attack: 0.03, decay: 1.0 },
    { freq: 587.33, startTime: 0.4, duration: 0.95, gain: 0.15, type: 'sine', attack: 0.03, decay: 0.85 },
  ],
  'digital-pulse': [
    // Modern, crisp electronic notification pulses (A5 -> D6 -> A6)
    { freq: 880.0, startTime: 0.0, duration: 0.07, gain: 0.4, type: 'triangle', attack: 0.004, decay: 0.06 },
    { freq: 1174.66, startTime: 0.08, duration: 0.08, gain: 0.45, type: 'triangle', attack: 0.004, decay: 0.07 },
    { freq: 1760.0, startTime: 0.18, duration: 0.45, gain: 0.45, type: 'triangle', attack: 0.004, decay: 0.4 },
    { freq: 880.0, startTime: 0.18, duration: 0.35, gain: 0.15, type: 'sine', attack: 0.01, decay: 0.3 },
  ],
  'gentle-sunrise': [
    // Calm, uplifting four-note sunrise pentatonic (C4 -> E4 -> G4 -> D5)
    { freq: 261.63, startTime: 0.0, duration: 1.0, gain: 0.28, type: 'sine', attack: 0.04, decay: 0.9 },
    { freq: 329.63, startTime: 0.26, duration: 1.0, gain: 0.3, type: 'sine', attack: 0.04, decay: 0.9 },
    { freq: 392.0, startTime: 0.52, duration: 1.1, gain: 0.32, type: 'sine', attack: 0.04, decay: 1.0 },
    { freq: 587.33, startTime: 0.8, duration: 1.35, gain: 0.36, type: 'sine', attack: 0.04, decay: 1.25 },
    { freq: 1174.66, startTime: 0.8, duration: 0.8, gain: 0.08, type: 'sine', attack: 0.04, decay: 0.7 },
  ],
  none: [],
}
