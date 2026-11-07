import { beforeEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from '../audioEngine'
import {
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
  type StoredAudioSettingsV1,
} from '../audioStorage'
import {
  loadPlannerState,
  savePlannerState,
  STORAGE_KEY,
  type StoredPlannerV1,
} from '../plannerStorage'
import {
  ATELIER_ORIGINAL_SCHEDULE,
  type ActivityDefinition,
  type Preset,
} from '../schedule'
import {
  isTuneId,
  TUNE_REGISTRY,
  TUNE_SYNTHESIS_PATTERNS,
  type TuneId,
} from '../sessionTunes'
import { areSchedulesEqual } from '../usePlannerState'
import { SessionBoundaryDetector } from '../useSessionEndSound'
import { validateSchedule } from '../validation'

// In-memory localStorage mock for node runner
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Web Audio API mock
class MockAudioNode {
  connect() {}
  disconnect() {}
}

class MockGainNode extends MockAudioNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn((val: number) => {
      this.gain.value = val
    }),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine'
  frequency = {
    setValueAtTime: vi.fn(),
  }
  start = vi.fn()
  stop = vi.fn()
}

class MockAudioContext {
  state: AudioContextState = 'running'
  currentTime = 100
  destination = new MockAudioNode()
  createGain = vi.fn(() => new MockGainNode())
  createOscillator = vi.fn(() => new MockOscillatorNode())
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  onstatechange: (() => void) | null = null
}

describe('Session Completion Tunes & Audio System', () => {
  let mockCtx: MockAudioContext

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    mockCtx = new MockAudioContext()
    audioEngine._injectContext(mockCtx as unknown as AudioContext)
  })

  describe('1. Tune Registry & Synthesis Specifications', () => {
    it('defines all 5 built-in tunes plus none with stable identifiers', () => {
      const requiredIds: TuneId[] = [
        'soft-chime',
        'crystal-bell',
        'warm-harmony',
        'digital-pulse',
        'gentle-sunrise',
        'none',
      ]

      for (const id of requiredIds) {
        expect(isTuneId(id)).toBe(true)
        const def = TUNE_REGISTRY[id]
        expect(def).toBeDefined()
        expect(def.name).toBeTruthy()
        expect(def.character).toBeTruthy()
      }
    })

    it('each tune has distinct character and synthesis pattern', () => {
      expect(TUNE_SYNTHESIS_PATTERNS['soft-chime'].length).toBeGreaterThan(0)
      expect(TUNE_SYNTHESIS_PATTERNS['crystal-bell'].length).toBeGreaterThan(0)
      expect(TUNE_SYNTHESIS_PATTERNS['warm-harmony'].length).toBeGreaterThan(0)
      expect(TUNE_SYNTHESIS_PATTERNS['digital-pulse'].length).toBeGreaterThan(0)
      expect(TUNE_SYNTHESIS_PATTERNS['gentle-sunrise'].length).toBeGreaterThan(0)
      expect(TUNE_SYNTHESIS_PATTERNS['none'].length).toBe(0)

      // Ensure tune frequencies and durations are positive and unique
      const chimeFreqs = TUNE_SYNTHESIS_PATTERNS['soft-chime'].map(s => s.freq)
      const pulseFreqs = TUNE_SYNTHESIS_PATTERNS['digital-pulse'].map(s => s.freq)
      expect(chimeFreqs).not.toEqual(pulseFreqs)
    })
  })

  describe('2. Audio Engine Synthesis & Playback', () => {
    it('plays tune notes with smooth envelopes and applies volume', async () => {
      const playPromise = audioEngine.playTune('crystal-bell', 60)
      expect(playPromise).toBeInstanceOf(Promise)
      const success = await playPromise
      expect(success).toBe(true)

      // Multiple oscillators and gains created for sparkling crystal bell
      expect(mockCtx.createOscillator).toHaveBeenCalled()
      expect(mockCtx.createGain).toHaveBeenCalled()
    })

    it('stops previous tune when new tune or preview begins', async () => {
      await audioEngine.playTune('soft-chime', 40)
      expect(audioEngine.getCurrentlyPlaying()).toBe('soft-chime')

      // Starting new tune stops previous
      await audioEngine.playTune('digital-pulse', 40)
      expect(audioEngine.getCurrentlyPlaying()).toBe('digital-pulse')

      audioEngine.stopAll()
      expect(audioEngine.getCurrentlyPlaying()).toBeNull()
    })

    it('none tune stops audio and schedules no sound', async () => {
      mockCtx.createOscillator.mockClear()
      const success = await audioEngine.playTune('none')
      expect(success).toBe(true)
      expect(mockCtx.createOscillator).not.toHaveBeenCalled()
      expect(audioEngine.getCurrentlyPlaying()).toBeNull()
    })
  })

  describe('3. Audio Settings Storage (atelier_focus_audio_v1)', () => {
    it('defaults to sounds disabled and 40% volume on first visit', () => {
      const settings = loadAudioSettings()
      expect(settings.version).toBe(1)
      expect(settings.enabled).toBe(false)
      expect(settings.volume).toBe(40)
    })

    it('persists enabled and volume changes independently', () => {
      const customSettings: StoredAudioSettingsV1 = {
        version: 1,
        enabled: true,
        volume: 75,
      }
      saveAudioSettings(customSettings)

      const loaded = loadAudioSettings()
      expect(loaded.enabled).toBe(true)
      expect(loaded.volume).toBe(75)
    })

    it('falls back safely if audio storage is corrupted', () => {
      localStorageMock.setItem('atelier_focus_audio_v1', '{malformed json')
      const loaded = loadAudioSettings()
      expect(loaded).toEqual(DEFAULT_AUDIO_SETTINGS)
    })
  })

  describe('4. Backward Compatibility & Migration of Presets', () => {
    it('assigns Soft Chime to activities missing endTuneId', () => {
      const rawLegacyPlanner = {
        version: 1,
        activeSchedule: [
          { id: 'act-1', name: 'Legacy Study', start: [9, 0], end: [12, 0], kind: 'study', icon: 'Brain' },
        ],
        activePresetId: null,
        defaultPresetId: 'atelier-original',
        customPresets: [
          {
            id: 'legacy-p1',
            name: 'Legacy Preset',
            blocks: [
              { id: 'act-2', name: 'Legacy Reading', start: [14, 0], end: [16, 0], kind: 'study', icon: 'BookOpenText' },
            ],
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      }

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(rawLegacyPlanner))

      const loaded = loadPlannerState()
      expect(loaded.activeSchedule[0].endTuneId).toBe('soft-chime')
      expect(loaded.customPresets[0].blocks[0].endTuneId).toBe('soft-chime')
    })

    it('normalizes unknown tune IDs safely to Soft Chime without rejecting the preset', () => {
      const rawUnknownTunePlanner = {
        version: 1,
        activeSchedule: [
          {
            id: 'act-1',
            name: 'Study',
            start: [9, 0],
            end: [12, 0],
            kind: 'study',
            icon: 'Brain',
            endTuneId: 'corrupted-tune-identifier',
          },
        ],
        activePresetId: null,
        defaultPresetId: 'atelier-original',
        customPresets: [],
      }

      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(rawUnknownTunePlanner))

      const loaded = loadPlannerState()
      expect(loaded.activeSchedule[0].endTuneId).toBe('soft-chime')
    })

    it('rejects invalid tune ID in validation if explicitly provided', () => {
      const invalidBlock: ActivityDefinition = {
        id: 'act-1',
        name: 'Work',
        start: [9, 0],
        end: [10, 0],
        kind: 'study',
        icon: 'Brain',
        endTuneId: 'non-existent-sound' as unknown as TuneId,
      }
      const res = validateSchedule([invalidBlock])
      expect(res.isValid).toBe(false)
      expect(res.blockErrors['act-1'].some(e => e.includes('completion sound'))).toBe(true)
    })
  })

  describe('5. Saving, Duplicating & Applying Presets with Selected Tunes', () => {
    it('preserves distinct tune selections across preset save, duplicate, and reload', () => {
      const blocksWithTunes: ActivityDefinition[] = [
        { id: 'math', name: 'Mathematics', start: [8, 0], end: [11, 0], kind: 'study', icon: 'Brain', endTuneId: 'crystal-bell' },
        { id: 'lunch', name: 'Lunch', start: [12, 0], end: [13, 0], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
        { id: 'code', name: 'Coding', start: [13, 0], end: [16, 0], kind: 'study', icon: 'Code2', endTuneId: 'digital-pulse' },
        { id: 'gym', name: 'Gym', start: [17, 0], end: [18, 0], kind: 'routine', icon: 'Dumbbell', endTuneId: 'warm-harmony' },
        { id: 'sleep', name: 'Sleep', start: [23, 0], end: [6, 30], kind: 'sleep', icon: 'Moon', endTuneId: 'gentle-sunrise' },
      ]

      const preset: Preset = {
        id: 'custom-tunes',
        name: 'Custom Tunes Routine',
        blocks: blocksWithTunes,
        createdAt: 2000,
        updatedAt: 2000,
        isBuiltIn: false,
      }

      const state: StoredPlannerV1 = {
        version: 1,
        activeSchedule: blocksWithTunes,
        activePresetId: 'custom-tunes',
        defaultPresetId: 'custom-tunes',
        customPresets: [preset],
      }

      savePlannerState(state)

      const loaded = loadPlannerState()
      const loadedBlocks = loaded.customPresets[0].blocks
      expect(loadedBlocks[0].endTuneId).toBe('crystal-bell')
      expect(loadedBlocks[1].endTuneId).toBe('soft-chime')
      expect(loadedBlocks[2].endTuneId).toBe('digital-pulse')
      expect(loadedBlocks[3].endTuneId).toBe('warm-harmony')
      expect(loadedBlocks[4].endTuneId).toBe('gentle-sunrise')
    })

    it('areSchedulesEqual detects changes in endTuneId to mark draft dirty', () => {
      const scheduleA: ActivityDefinition[] = [
        { id: '1', name: 'Study', start: [9, 0], end: [10, 0], kind: 'study', icon: 'Brain', endTuneId: 'soft-chime' },
      ]
      const scheduleB: ActivityDefinition[] = [
        { id: '1', name: 'Study', start: [9, 0], end: [10, 0], kind: 'study', icon: 'Brain', endTuneId: 'crystal-bell' },
      ]

      expect(areSchedulesEqual(scheduleA, scheduleB)).toBe(false)

      const scheduleC: ActivityDefinition[] = [
        { id: '1', name: 'Study', start: [9, 0], end: [10, 0], kind: 'study', icon: 'Brain', endTuneId: 'soft-chime' },
      ]
      expect(areSchedulesEqual(scheduleA, scheduleC)).toBe(true)
    })
  })

  describe('6. Reliable Session-End Detection (SessionBoundaryDetector)', () => {
    it('plays exactly once per completed activity occurrence and plays ending activity tune', () => {
      vi.useFakeTimers()
      const playedTunes: string[] = []
      const completedActivities: string[] = []

      vi.spyOn(audioEngine, 'playTune').mockImplementation(async (tuneId: TuneId) => {
        playedTunes.push(tuneId)
        return true
      })

      // Current base time: 2026-11-07 14:00:00
      let currentTime = new Date(2026, 10, 7, 14, 0, 0).getTime()
      const nowProvider = () => currentTime

      // Schedule:
      // Coding: 14:00 - 15:00, Digital Pulse
      // Lunch:  15:00 - 16:00, Soft Chime
      const schedule: ActivityDefinition[] = [
        { id: 'coding', name: 'Coding', start: [14, 0], end: [15, 0], kind: 'study', icon: 'Code2', endTuneId: 'digital-pulse' },
        { id: 'lunch', name: 'Lunch', start: [15, 0], end: [16, 0], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
      ]

      // Mount detector at 14:00:00
      const detector = new SessionBoundaryDetector({
        schedule,
        enabled: true,
        volume: 40,
        nowProvider,
        onSessionComplete: activity => {
          completedActivities.push(activity.id)
        },
      })

      // Advance clock to 14:30 (middle of Coding session) -> no tune should play
      currentTime = new Date(2026, 10, 7, 14, 30, 0).getTime()
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(playedTunes.length).toBe(0)
      expect(completedActivities.length).toBe(0)

      // Advance clock to exactly 15:00:00 -> Coding ends!
      currentTime = new Date(2026, 10, 7, 15, 0, 0).getTime()
      vi.advanceTimersByTime(30 * 60 * 1000)

      // Coding's Digital Pulse must play (NOT Lunch's Soft Chime!)
      expect(completedActivities).toEqual(['coding'])
      expect(playedTunes).toEqual(['digital-pulse'])

      // Advance clock slightly (15:00:02) -> must NOT trigger a second time
      currentTime += 2000
      vi.advanceTimersByTime(2000)
      expect(completedActivities).toEqual(['coding'])
      expect(playedTunes).toEqual(['digital-pulse'])

      // Advance clock to 16:00:00 -> Lunch ends!
      currentTime = new Date(2026, 10, 7, 16, 0, 0).getTime()
      vi.advanceTimersByTime(60 * 60 * 1000 - 2000)

      expect(completedActivities).toEqual(['coding', 'lunch'])
      expect(playedTunes).toEqual(['digital-pulse', 'soft-chime'])

      detector.destroy()
      vi.useRealTimers()
    })

    it('handles overnight sessions across midnight correctly', () => {
      vi.useFakeTimers()
      const playedTunes: string[] = []

      vi.spyOn(audioEngine, 'playTune').mockImplementation(async (tuneId: TuneId) => {
        playedTunes.push(tuneId)
        return true
      })

      // Sleep: 23:00 to 06:30, Gentle Sunrise
      const schedule: ActivityDefinition[] = [
        { id: 'sleep', name: 'Sleep', start: [23, 0], end: [6, 30], kind: 'sleep', icon: 'Moon', endTuneId: 'gentle-sunrise' },
      ]

      // Mount at 23:30 (overnight in progress)
      let currentTime = new Date(2026, 10, 7, 23, 30, 0).getTime()
      const nowProvider = () => currentTime

      const detector = new SessionBoundaryDetector({
        schedule,
        enabled: true,
        volume: 40,
        nowProvider,
      })

      // No tune on mount
      expect(playedTunes.length).toBe(0)

      // Advance past midnight to 06:30 next morning
      currentTime = new Date(2026, 10, 8, 6, 30, 0).getTime()
      vi.advanceTimersByTime(7 * 60 * 60 * 1000)

      expect(playedTunes).toEqual(['gentle-sunrise'])

      detector.destroy()
      vi.useRealTimers()
    })

    it('handles gaps between activities correctly', () => {
      vi.useFakeTimers()
      const playedTunes: string[] = []

      vi.spyOn(audioEngine, 'playTune').mockImplementation(async (tuneId: TuneId) => {
        playedTunes.push(tuneId)
        return true
      })

      // Block A: 10:00 - 11:00 (Warm Harmony)
      // Gap: 11:00 - 13:00
      // Block B: 13:00 - 14:00 (Digital Pulse)
      const schedule: ActivityDefinition[] = [
        { id: 'a', name: 'Block A', start: [10, 0], end: [11, 0], kind: 'study', icon: 'Brain', endTuneId: 'warm-harmony' },
        { id: 'b', name: 'Block B', start: [13, 0], end: [14, 0], kind: 'study', icon: 'Code2', endTuneId: 'digital-pulse' },
      ]

      let currentTime = new Date(2026, 10, 7, 10, 30, 0).getTime()
      const detector = new SessionBoundaryDetector({
        schedule,
        enabled: true,
        volume: 40,
        nowProvider: () => currentTime,
      })

      // Advance to 11:00 -> Block A finishes
      currentTime = new Date(2026, 10, 7, 11, 0, 0).getTime()
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(playedTunes).toEqual(['warm-harmony'])

      // Advance to 12:00 (inside gap) -> no sound
      currentTime = new Date(2026, 10, 7, 12, 0, 0).getTime()
      vi.advanceTimersByTime(60 * 60 * 1000)
      expect(playedTunes).toEqual(['warm-harmony'])

      // Advance to 14:00 -> Block B finishes
      currentTime = new Date(2026, 10, 7, 14, 0, 0).getTime()
      vi.advanceTimersByTime(2 * 60 * 60 * 1000)
      expect(playedTunes).toEqual(['warm-harmony', 'digital-pulse'])

      detector.destroy()
      vi.useRealTimers()
    })

    it('respects master mute toggle, zero volume, and None tune selections', () => {
      vi.useFakeTimers()
      const playSpy = vi.spyOn(audioEngine, 'playTune').mockImplementation(async () => true)

      let currentTime = new Date(2026, 10, 7, 9, 30, 0).getTime()

      // 1. Muted global toggle
      const schedule: ActivityDefinition[] = [
        { id: 's1', name: 'Study', start: [9, 0], end: [10, 0], kind: 'study', icon: 'Brain', endTuneId: 'crystal-bell' },
      ]

      const detector1 = new SessionBoundaryDetector({
        schedule,
        enabled: false, // MUTED
        volume: 40,
        nowProvider: () => currentTime,
      })

      currentTime = new Date(2026, 10, 7, 10, 0, 0).getTime()
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(playSpy).not.toHaveBeenCalled()
      detector1.destroy()

      // 2. Individual None tune selection
      const scheduleWithNone: ActivityDefinition[] = [
        { id: 's2', name: 'Quiet Break', start: [10, 0], end: [11, 0], kind: 'break', icon: 'Coffee', endTuneId: 'none' },
      ]
      currentTime = new Date(2026, 10, 7, 10, 30, 0).getTime()

      const detector2 = new SessionBoundaryDetector({
        schedule: scheduleWithNone,
        enabled: true,
        volume: 50,
        nowProvider: () => currentTime,
      })

      currentTime = new Date(2026, 10, 7, 11, 0, 0).getTime()
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(playSpy).not.toHaveBeenCalled()

      detector2.destroy()
      vi.useRealTimers()
    })

    it('never plays sounds for past boundaries on initial load or page refresh', () => {
      vi.useFakeTimers()
      const playSpy = vi.spyOn(audioEngine, 'playTune').mockImplementation(async () => true)

      // Time is 14:15. Previous activities ended at 07:00, 10:00, 10:30, 11:00, 14:00
      const currentTime = new Date(2026, 10, 7, 14, 15, 0).getTime()

      const detector = new SessionBoundaryDetector({
        schedule: ATELIER_ORIGINAL_SCHEDULE,
        enabled: true,
        volume: 40,
        nowProvider: () => currentTime,
      })

      // No tunes should fire on mount
      expect(playSpy).not.toHaveBeenCalled()

      detector.destroy()
      vi.useRealTimers()
    })

    it('no playback after schedule changes for boundaries that already passed', () => {
      vi.useFakeTimers()
      const playSpy = vi.spyOn(audioEngine, 'playTune').mockImplementation(async () => true)

      // Initial schedule: Session at 10:00-11:00
      const initialSchedule: ActivityDefinition[] = [
        { id: 'old-1', name: 'Old Morning', start: [10, 0], end: [11, 0], kind: 'study', icon: 'Brain', endTuneId: 'crystal-bell' },
      ]

      let currentTime = new Date(2026, 10, 7, 11, 5, 0).getTime()

      const detector = new SessionBoundaryDetector({
        schedule: initialSchedule,
        enabled: true,
        volume: 40,
        nowProvider: () => currentTime,
      })

      // Switch schedule at 11:05 to a new schedule that had a block ending at 11:02
      const updatedSchedule: ActivityDefinition[] = [
        { id: 'new-1', name: 'New Block', start: [10, 30], end: [11, 2], kind: 'study', icon: 'Code2', endTuneId: 'digital-pulse' },
        { id: 'new-2', name: 'Upcoming', start: [11, 2], end: [12, 0], kind: 'study', icon: 'Code2', endTuneId: 'digital-pulse' },
      ]

      detector.updateOptions({ schedule: updatedSchedule })

      // Verify that the 11:02 boundary is NOT triggered because it was already in the past
      expect(playSpy).not.toHaveBeenCalled()

      // Advance to 12:00:00 -> new-2 should trigger
      currentTime = new Date(2026, 10, 7, 12, 0, 0).getTime()
      vi.advanceTimersByTime(55 * 60 * 1000)
      expect(playSpy).toHaveBeenCalledWith('digital-pulse', 40)

      detector.destroy()
      vi.useRealTimers()
    })

    it('skips tunes when boundaries were missed by more than 5 seconds (grace period)', () => {
      vi.useFakeTimers()
      const playedTunes: string[] = []

      vi.spyOn(audioEngine, 'playTune').mockImplementation(async (tuneId: TuneId) => {
        playedTunes.push(tuneId)
        return true
      })

      const schedule: ActivityDefinition[] = [
        { id: 'deepwork', name: 'Deep Work', start: [9, 0], end: [10, 0], kind: 'study', icon: 'Brain', endTuneId: 'crystal-bell' },
      ]

      let currentTime = new Date(2026, 10, 7, 9, 30, 0).getTime()

      const detector = new SessionBoundaryDetector({
        schedule,
        enabled: true,
        volume: 40,
        nowProvider: () => currentTime,
      })

      // Simulate laptop asleep for 10 minutes: wakes at 10:10:00 (diff = 600 seconds > 5s grace period)
      currentTime = new Date(2026, 10, 7, 10, 10, 0).getTime()
      vi.advanceTimersByTime(40 * 60 * 1000)

      // Must be skipped to avoid catch-up noise bursts
      expect(playedTunes.length).toBe(0)

      detector.destroy()
      vi.useRealTimers()
    })
  })
})
