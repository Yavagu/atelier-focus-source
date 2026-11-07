import { beforeEach, describe, expect, it } from 'vitest'
import {
  deepClone,
  loadPlannerState,
  savePlannerState,
  STORAGE_KEY,
  type StoredPlannerV1,
} from '../plannerStorage'
import {
  ATELIER_ORIGINAL_PRESET,
  ATELIER_ORIGINAL_SCHEDULE,
  type ActivityDefinition,
  type Preset,
} from '../schedule'

// Mock in-memory localStorage for Node test runner
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

describe('Planner Storage & Presets', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('1. First visit loads Atelier Original as active and default preset', () => {
    const state = loadPlannerState()
    expect(state.activePresetId).toBe('atelier-original')
    expect(state.defaultPresetId).toBe('atelier-original')
    expect(state.activeSchedule.length).toBe(12)
    expect(state.customPresets.length).toBe(0)
  })

  it('2. Atelier Original preset is immutable', () => {
    const original = ATELIER_ORIGINAL_PRESET
    expect(original.id).toBe('atelier-original')
    expect(original.isBuiltIn).toBe(true)

    // Verify modifying a loaded copy does not affect the constant
    const loaded = loadPlannerState()
    loaded.activeSchedule[0].name = 'Modified Name'
    expect(ATELIER_ORIGINAL_SCHEDULE[0].name).toBe('Wake Up & Freshen Up')
    expect(ATELIER_ORIGINAL_PRESET.blocks[0].name).toBe('Wake Up & Freshen Up')
  })

  it('3. Custom preset saves and loads correctly', () => {
    const customBlocks: ActivityDefinition[] = [
      { id: 'math', name: 'Mathematics', start: [8, 0], end: [11, 0], kind: 'study', icon: 'Brain' },
      { id: 'gym', name: 'Gym', start: [17, 0], end: [18, 0], kind: 'routine', icon: 'Dumbbell' },
    ]

    const newPreset: Preset = {
      id: 'custom-1',
      name: 'Productive Day',
      blocks: customBlocks,
      createdAt: 1000,
      updatedAt: 1000,
      isBuiltIn: false,
    }

    const state: StoredPlannerV1 = {
      version: 1,
      activeSchedule: ATELIER_ORIGINAL_SCHEDULE,
      activePresetId: 'atelier-original',
      defaultPresetId: 'atelier-original',
      customPresets: [newPreset],
    }

    const saveRes = savePlannerState(state)
    expect(saveRes.success).toBe(true)

    const loaded = loadPlannerState()
    expect(loaded.customPresets.length).toBe(1)
    expect(loaded.customPresets[0].id).toBe('custom-1')
    expect(loaded.customPresets[0].name).toBe('Productive Day')
    expect(loaded.customPresets[0].blocks.length).toBe(2)
  })

  it('4. Applying a custom timetable updates the active schedule in storage', () => {
    const customBlocks: ActivityDefinition[] = [
      { id: 'code', name: 'Coding', start: [9, 0], end: [12, 0], kind: 'study', icon: 'Code2' },
    ]

    const state: StoredPlannerV1 = {
      version: 1,
      activeSchedule: customBlocks,
      activePresetId: null, // Custom schedule not bound to named preset
      defaultPresetId: 'atelier-original',
      customPresets: [],
    }

    savePlannerState(state)
    const loaded = loadPlannerState()
    expect(loaded.activeSchedule.length).toBe(1)
    expect(loaded.activeSchedule[0].name).toBe('Coding')
    expect(loaded.activePresetId).toBeNull()
  })

  it('5. Saving a preset without applying does not change the active schedule', () => {
    const customBlocks: ActivityDefinition[] = [
      { id: 'read', name: 'Reading', start: [10, 0], end: [12, 0], kind: 'study', icon: 'BookOpenText' },
    ]

    const state: StoredPlannerV1 = {
      version: 1,
      activeSchedule: deepClone(ATELIER_ORIGINAL_SCHEDULE),
      activePresetId: 'atelier-original',
      defaultPresetId: 'atelier-original',
      customPresets: [
        {
          id: 'read-preset',
          name: 'Reading Routine',
          blocks: customBlocks,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }

    savePlannerState(state)
    const loaded = loadPlannerState()
    expect(loaded.activeSchedule.length).toBe(12)
    expect(loaded.activePresetId).toBe('atelier-original')
    expect(loaded.customPresets[0].name).toBe('Reading Routine')
  })

  it('6. Deleting the active preset preserves the active timetable but clears activePresetId', () => {
    const customBlocks: ActivityDefinition[] = [
      { id: 's1', name: 'Deep Work', start: [8, 0], end: [12, 0], kind: 'study', icon: 'Brain' },
    ]

    const state: StoredPlannerV1 = {
      version: 1,
      activeSchedule: customBlocks,
      activePresetId: 'custom-to-delete',
      defaultPresetId: 'atelier-original',
      customPresets: [
        {
          id: 'custom-to-delete',
          name: 'To Delete',
          blocks: customBlocks,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    }

    savePlannerState(state)

    // Now simulate deleting that preset:
    const loaded = loadPlannerState()
    const nextCustom = loaded.customPresets.filter(p => p.id !== 'custom-to-delete')
    const nextState: StoredPlannerV1 = {
      ...loaded,
      activePresetId: loaded.activePresetId === 'custom-to-delete' ? null : loaded.activePresetId,
      customPresets: nextCustom,
    }

    savePlannerState(nextState)
    const reloaded = loadPlannerState()
    expect(reloaded.activeSchedule.length).toBe(1)
    expect(reloaded.activeSchedule[0].name).toBe('Deep Work')
    expect(reloaded.activePresetId).toBeNull()
    expect(reloaded.customPresets.length).toBe(0)
  })

  it('7. Deleting the default preset safely falls back to atelier-original', () => {
    const state: StoredPlannerV1 = {
      version: 1,
      activeSchedule: ATELIER_ORIGINAL_SCHEDULE,
      activePresetId: 'atelier-original',
      defaultPresetId: 'custom-default',
      customPresets: [
        {
          id: 'custom-default',
          name: 'My Default',
          blocks: ATELIER_ORIGINAL_SCHEDULE,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    }

    savePlannerState(state)

    // Remove the default preset
    const loaded = loadPlannerState()
    const nextState: StoredPlannerV1 = {
      ...loaded,
      defaultPresetId:
        loaded.defaultPresetId === 'custom-default' ? 'atelier-original' : loaded.defaultPresetId,
      customPresets: [],
    }

    savePlannerState(nextState)
    const reloaded = loadPlannerState()
    expect(reloaded.defaultPresetId).toBe('atelier-original')
  })

  it('8. Corrupted storage data falls back safely to initial state without throwing', () => {
    // Malformed JSON string
    localStorageMock.setItem(STORAGE_KEY, '{ invalid JSON : true')
    const state1 = loadPlannerState()
    expect(state1.activePresetId).toBe('atelier-original')
    expect(state1.activeSchedule.length).toBe(12)

    // Invalid schema version
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ version: 999 }))
    const state2 = loadPlannerState()
    expect(state2.activePresetId).toBe('atelier-original')

    // Invalid activities
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeSchedule: [{ id: 'corrupt', name: '', start: 'bad' }],
      })
    )
    const state3 = loadPlannerState()
    expect(state3.activeSchedule.length).toBe(12)
    expect(state3.activePresetId).toBe('atelier-original')
  })
})
