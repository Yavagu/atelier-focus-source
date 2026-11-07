import {
  ATELIER_ORIGINAL_PRESET,
  ATELIER_ORIGINAL_SCHEDULE,
  sortActivitiesChronologically,
  type ActivityDefinition,
  type Preset,
} from './schedule'
import { validateSchedule } from './validation'

export const STORAGE_KEY = 'atelier_focus_planner_v1'
export const CURRENT_SCHEMA_VERSION = 1

export interface StoredPlannerV1 {
  version: 1
  activeSchedule: ActivityDefinition[]
  activePresetId: string | null
  defaultPresetId: string
  customPresets: Preset[]
}

export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj)
    } catch {
      // Fallback below
    }
  }
  return JSON.parse(JSON.stringify(obj))
}

export function getInitialPlannerState(): StoredPlannerV1 {
  return {
    version: CURRENT_SCHEMA_VERSION,
    activeSchedule: deepClone(ATELIER_ORIGINAL_SCHEDULE),
    activePresetId: ATELIER_ORIGINAL_PRESET.id,
    defaultPresetId: ATELIER_ORIGINAL_PRESET.id,
    customPresets: [],
  }
}

function sanitizeBlocks(blocks: unknown): ActivityDefinition[] | null {
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  const sanitized: ActivityDefinition[] = []

  for (const item of blocks) {
    if (!item || typeof item !== 'object') return null
    const b = item as Partial<ActivityDefinition>
    if (typeof b.id !== 'string' || !b.id) return null
    if (typeof b.name !== 'string') return null
    if (!Array.isArray(b.start) || b.start.length !== 2) return null
    if (!Array.isArray(b.end) || b.end.length !== 2) return null
    if (typeof b.kind !== 'string') return null
    if (typeof b.icon !== 'string') return null

    sanitized.push({
      id: b.id,
      name: b.name.trim(),
      start: [Number(b.start[0]), Number(b.start[1])],
      end: [Number(b.end[0]), Number(b.end[1])],
      kind: b.kind as ActivityDefinition['kind'],
      icon: b.icon as ActivityDefinition['icon'],
    })
  }

  const validation = validateSchedule(sanitized)
  if (!validation.isValid) return null
  return sortActivitiesChronologically(sanitized)
}

function sanitizeCustomPresets(rawPresets: unknown): Preset[] {
  if (!Array.isArray(rawPresets)) return []
  const presets: Preset[] = []

  for (const item of rawPresets) {
    if (!item || typeof item !== 'object') continue
    const p = item as Partial<Preset>
    if (typeof p.id !== 'string' || !p.id || p.id === ATELIER_ORIGINAL_PRESET.id) continue
    if (typeof p.name !== 'string' || !p.name.trim()) continue

    const blocks = sanitizeBlocks(p.blocks)
    if (!blocks) continue

    presets.push({
      id: p.id,
      name: p.name.trim().slice(0, 40),
      blocks,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
      isBuiltIn: false,
    })
  }

  return presets
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage
    }
  } catch {
    // Storage access blocked or restricted
  }
  return null
}

export function loadPlannerState(): StoredPlannerV1 {
  try {
    const storage = getStorage()
    if (!storage) {
      return getInitialPlannerState()
    }

    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      return getInitialPlannerState()
    }

    const parsed = JSON.parse(raw) as Partial<StoredPlannerV1>
    if (!parsed || typeof parsed !== 'object') {
      return getInitialPlannerState()
    }

    if (parsed.version !== CURRENT_SCHEMA_VERSION) {
      // Future migrations could be added here; for now, fallback safely
      return getInitialPlannerState()
    }

    const customPresets = sanitizeCustomPresets(parsed.customPresets)
    const allPresetIds = new Set([
      ATELIER_ORIGINAL_PRESET.id,
      ...customPresets.map(p => p.id),
    ])

    let activePresetId =
      typeof parsed.activePresetId === 'string' && allPresetIds.has(parsed.activePresetId)
        ? parsed.activePresetId
        : null

    let activeSchedule = sanitizeBlocks(parsed.activeSchedule)
    if (!activeSchedule) {
      activeSchedule = deepClone(ATELIER_ORIGINAL_SCHEDULE)
      if (!activePresetId) {
        activePresetId = ATELIER_ORIGINAL_PRESET.id
      }
    }

    const defaultPresetId =
      typeof parsed.defaultPresetId === 'string' && allPresetIds.has(parsed.defaultPresetId)
        ? parsed.defaultPresetId
        : ATELIER_ORIGINAL_PRESET.id

    return {
      version: CURRENT_SCHEMA_VERSION,
      activeSchedule,
      activePresetId,
      defaultPresetId,
      customPresets,
    }
  } catch (err) {
    console.warn('Failed to load planner state from storage, falling back to default:', err)
    return getInitialPlannerState()
  }
}

export function savePlannerState(
  state: StoredPlannerV1
): { success: boolean; error?: string } {
  try {
    const storage = getStorage()
    if (!storage) {
      return { success: false, error: 'Local storage is not available in this environment.' }
    }

    const payload: StoredPlannerV1 = {
      version: CURRENT_SCHEMA_VERSION,
      activeSchedule: state.activeSchedule,
      activePresetId: state.activePresetId,
      defaultPresetId: state.defaultPresetId,
      customPresets: state.customPresets,
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return { success: true }
  } catch (err: unknown) {
    console.error('Failed to save planner state:', err)
    const message =
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Browser storage quota exceeded. Unable to save changes locally.'
        : 'Failed to write to local storage.'
    return { success: false, error: message }
  }
}
