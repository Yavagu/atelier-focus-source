import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_KIND_ICONS } from './ActivityIcon'
import {
  deepClone,
  loadPlannerState,
  savePlannerState,
  type StoredPlannerV1,
} from './plannerStorage'
import {
  ATELIER_ORIGINAL_PRESET,
  sortActivitiesChronologically,
  type ActivityDefinition,
  type ActivityKind,
  type Preset,
} from './schedule'
import { validatePresetName, validateSchedule, type ValidationResult } from './validation'

export interface PlannerState {
  activeSchedule: ActivityDefinition[]
  activePresetId: string | null
  defaultPresetId: string
  customPresets: Preset[]
  allPresets: Preset[]
  draftSchedule: ActivityDefinition[]
  editingPresetId: string | null
  scheduleRevision: number
  isDirty: boolean
  isDraftApplied: boolean
  validation: ValidationResult
  // Actions
  loadPreset: (presetId: string, force?: boolean) => boolean
  applyDraftToTimer: () => { success: boolean; error?: string }
  saveAsNewPreset: (name: string) => { success: boolean; error?: string; presetId?: string }
  updatePreset: (presetId: string) => { success: boolean; error?: string }
  renamePreset: (presetId: string, newName: string) => { success: boolean; error?: string }
  duplicatePreset: (presetId: string) => { success: boolean; error?: string; newPresetId?: string }
  deletePreset: (presetId: string) => { success: boolean; error?: string }
  setAsDefault: (presetId: string) => { success: boolean; error?: string }
  loadDefault: () => void
  loadOriginal: () => void
  discardDraft: () => void
  updateDraftBlock: (id: string, updates: Partial<ActivityDefinition>) => void
  addDraftBlock: () => string
  deleteDraftBlock: (id: string) => void
  reorderDraftBlocks?: (sourceIndex: number, destIndex: number) => void
}

export function areSchedulesEqual(a: ActivityDefinition[], b: ActivityDefinition[]): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i]
    const itemB = b[i]
    if (
      itemA.id !== itemB.id ||
      itemA.name.trim() !== itemB.name.trim() ||
      itemA.kind !== itemB.kind ||
      itemA.icon !== itemB.icon ||
      itemA.start[0] !== itemB.start[0] ||
      itemA.start[1] !== itemB.start[1] ||
      itemA.end[0] !== itemB.end[0] ||
      itemA.end[1] !== itemB.end[1]
    ) {
      return false
    }
  }
  return true
}

export function usePlannerState(): PlannerState {
  const [planner, setPlanner] = useState<StoredPlannerV1>(() => loadPlannerState())
  const [draftSchedule, setDraftSchedule] = useState<ActivityDefinition[]>(() =>
    deepClone(planner.activeSchedule)
  )
  const [editingPresetId, setEditingPresetId] = useState<string | null>(planner.activePresetId)
  const [scheduleRevision, setScheduleRevision] = useState(0)

  // Baseline to determine whether the user made unsaved changes to the currently loaded preset/schedule
  const [baselineSchedule, setBaselineSchedule] = useState<ActivityDefinition[]>(() =>
    deepClone(planner.activeSchedule)
  )

  const allPresets = useMemo(() => {
    return [ATELIER_ORIGINAL_PRESET, ...planner.customPresets]
  }, [planner.customPresets])

  const validation = useMemo(() => {
    return validateSchedule(draftSchedule)
  }, [draftSchedule])

  const isDirty = useMemo(() => {
    return !areSchedulesEqual(draftSchedule, baselineSchedule)
  }, [draftSchedule, baselineSchedule])

  const isDraftApplied = useMemo(() => {
    return areSchedulesEqual(draftSchedule, planner.activeSchedule)
  }, [draftSchedule, planner.activeSchedule])

  // Helper to persist planner updates
  const persist = useCallback((nextPlanner: StoredPlannerV1) => {
    setPlanner(nextPlanner)
    return savePlannerState(nextPlanner)
  }, [])

  const loadPreset = useCallback(
    (presetId: string): boolean => {
      const target = allPresets.find(p => p.id === presetId)
      if (!target) return false

      const cloned = deepClone(target.blocks)
      setDraftSchedule(cloned)
      setBaselineSchedule(deepClone(cloned))
      setEditingPresetId(target.id)
      return true
    },
    [allPresets]
  )

  const applyDraftToTimer = useCallback((): { success: boolean; error?: string } => {
    const val = validateSchedule(draftSchedule)
    if (!val.isValid) {
      return { success: false, error: 'Cannot apply: schedule contains errors or overlaps.' }
    }

    const normalized = sortActivitiesChronologically(
      draftSchedule.map(b => ({
        ...b,
        name: b.name.trim(),
      }))
    )

    // Check if the normalized applied schedule matches any known preset
    let matchedPresetId: string | null = null
    if (editingPresetId) {
      const current = allPresets.find(p => p.id === editingPresetId)
      if (current && areSchedulesEqual(normalized, current.blocks)) {
        matchedPresetId = current.id
      }
    }
    if (!matchedPresetId) {
      const found = allPresets.find(p => areSchedulesEqual(normalized, p.blocks))
      if (found) matchedPresetId = found.id
    }

    const nextPlanner: StoredPlannerV1 = {
      ...planner,
      activeSchedule: deepClone(normalized),
      activePresetId: matchedPresetId,
    }

    const saveResult = persist(nextPlanner)
    if (!saveResult.success) {
      return saveResult
    }

    setDraftSchedule(deepClone(normalized))
    setBaselineSchedule(deepClone(normalized))
    setScheduleRevision(r => r + 1)

    return { success: true }
  }, [draftSchedule, editingPresetId, allPresets, planner, persist])

  const saveAsNewPreset = useCallback(
    (name: string): { success: boolean; error?: string; presetId?: string } => {
      const val = validateSchedule(draftSchedule)
      if (!val.isValid) {
        return { success: false, error: 'Cannot save preset: schedule contains errors or overlaps.' }
      }

      const nameVal = validatePresetName(name, allPresets)
      if (!nameVal.isValid) {
        return { success: false, error: nameVal.error }
      }

      const normalized = sortActivitiesChronologically(
        draftSchedule.map(b => ({
          ...b,
          name: b.name.trim(),
        }))
      )

      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `preset-${Date.now()}`
      const newPreset: Preset = {
        id: newId,
        name: name.trim(),
        blocks: deepClone(normalized),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isBuiltIn: false,
      }

      const nextCustom = [...planner.customPresets, newPreset]
      const nextPlanner: StoredPlannerV1 = {
        ...planner,
        customPresets: nextCustom,
      }

      const saveResult = persist(nextPlanner)
      if (!saveResult.success) {
        return saveResult
      }

      setDraftSchedule(deepClone(normalized))
      setBaselineSchedule(deepClone(normalized))
      setEditingPresetId(newId)

      return { success: true, presetId: newId }
    },
    [draftSchedule, allPresets, planner, persist]
  )

  const updatePreset = useCallback(
    (presetId: string): { success: boolean; error?: string } => {
      if (presetId === ATELIER_ORIGINAL_PRESET.id) {
        return { success: false, error: 'The built-in Atelier Original preset cannot be modified.' }
      }

      const target = planner.customPresets.find(p => p.id === presetId)
      if (!target) {
        return { success: false, error: 'Preset not found.' }
      }

      const val = validateSchedule(draftSchedule)
      if (!val.isValid) {
        return { success: false, error: 'Cannot update preset: schedule contains errors or overlaps.' }
      }

      const normalized = sortActivitiesChronologically(
        draftSchedule.map(b => ({
          ...b,
          name: b.name.trim(),
        }))
      )

      const nextCustom = planner.customPresets.map(p => {
        if (p.id !== presetId) return p
        return {
          ...p,
          blocks: deepClone(normalized),
          updatedAt: Date.now(),
        }
      })

      // If this preset was the active preset, verify if activeSchedule still matches
      let nextActivePresetId = planner.activePresetId
      if (planner.activePresetId === presetId && !areSchedulesEqual(normalized, planner.activeSchedule)) {
        nextActivePresetId = null
      }

      const nextPlanner: StoredPlannerV1 = {
        ...planner,
        activePresetId: nextActivePresetId,
        customPresets: nextCustom,
      }

      const saveResult = persist(nextPlanner)
      if (!saveResult.success) {
        return saveResult
      }

      setDraftSchedule(deepClone(normalized))
      setBaselineSchedule(deepClone(normalized))

      return { success: true }
    },
    [draftSchedule, planner, persist]
  )

  const renamePreset = useCallback(
    (presetId: string, newName: string): { success: boolean; error?: string } => {
      if (presetId === ATELIER_ORIGINAL_PRESET.id) {
        return { success: false, error: 'The built-in Atelier Original preset cannot be renamed.' }
      }

      const nameVal = validatePresetName(newName, allPresets, presetId)
      if (!nameVal.isValid) {
        return { success: false, error: nameVal.error }
      }

      const nextCustom = planner.customPresets.map(p => {
        if (p.id !== presetId) return p
        return {
          ...p,
          name: newName.trim(),
          updatedAt: Date.now(),
        }
      })

      const nextPlanner: StoredPlannerV1 = {
        ...planner,
        customPresets: nextCustom,
      }

      return persist(nextPlanner)
    },
    [allPresets, planner, persist]
  )

  const duplicatePreset = useCallback(
    (presetId: string): { success: boolean; error?: string; newPresetId?: string } => {
      const target = allPresets.find(p => p.id === presetId)
      if (!target) {
        return { success: false, error: 'Preset not found.' }
      }

      // Generate unique name
      let baseName = `${target.name} Copy`
      let candidate = baseName
      let counter = 2
      while (allPresets.some(p => p.name.trim().toLowerCase() === candidate.trim().toLowerCase())) {
        candidate = `${target.name} Copy ${counter}`
        counter++
      }

      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `preset-${Date.now()}`
      const newPreset: Preset = {
        id: newId,
        name: candidate.slice(0, 40),
        blocks: deepClone(target.blocks),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isBuiltIn: false,
      }

      const nextCustom = [...planner.customPresets, newPreset]
      const nextPlanner: StoredPlannerV1 = {
        ...planner,
        customPresets: nextCustom,
      }

      const saveResult = persist(nextPlanner)
      if (!saveResult.success) {
        return saveResult
      }

      return { success: true, newPresetId: newId }
    },
    [allPresets, planner, persist]
  )

  const deletePreset = useCallback(
    (presetId: string): { success: boolean; error?: string } => {
      if (presetId === ATELIER_ORIGINAL_PRESET.id) {
        return { success: false, error: 'The built-in Atelier Original preset cannot be deleted.' }
      }

      const target = planner.customPresets.find(p => p.id === presetId)
      if (!target) {
        return { success: false, error: 'Preset not found.' }
      }

      const nextCustom = planner.customPresets.filter(p => p.id !== presetId)
      const nextActivePresetId = planner.activePresetId === presetId ? null : planner.activePresetId
      const nextDefaultPresetId =
        planner.defaultPresetId === presetId ? ATELIER_ORIGINAL_PRESET.id : planner.defaultPresetId

      const nextPlanner: StoredPlannerV1 = {
        ...planner,
        activePresetId: nextActivePresetId,
        defaultPresetId: nextDefaultPresetId,
        customPresets: nextCustom,
      }

      const saveResult = persist(nextPlanner)
      if (!saveResult.success) {
        return saveResult
      }

      if (editingPresetId === presetId) {
        const fallback = deepClone(planner.activeSchedule)
        setDraftSchedule(fallback)
        setBaselineSchedule(deepClone(fallback))
        setEditingPresetId(nextActivePresetId)
      }

      return { success: true }
    },
    [planner, editingPresetId, persist]
  )

  const setAsDefault = useCallback(
    (presetId: string): { success: boolean; error?: string } => {
      const exists = allPresets.some(p => p.id === presetId)
      if (!exists) {
        return { success: false, error: 'Preset does not exist.' }
      }

      const nextPlanner: StoredPlannerV1 = {
        ...planner,
        defaultPresetId: presetId,
      }

      return persist(nextPlanner)
    },
    [allPresets, planner, persist]
  )

  const loadDefault = useCallback(() => {
    loadPreset(planner.defaultPresetId)
  }, [loadPreset, planner.defaultPresetId])

  const loadOriginal = useCallback(() => {
    loadPreset(ATELIER_ORIGINAL_PRESET.id)
  }, [loadPreset])

  const discardDraft = useCallback(() => {
    setDraftSchedule(deepClone(baselineSchedule))
  }, [baselineSchedule])

  const updateDraftBlock = useCallback(
    (id: string, updates: Partial<ActivityDefinition>) => {
      setDraftSchedule(prev =>
        prev.map(b => {
          if (b.id !== id) return b
          const updated = { ...b, ...updates }
          // If category changes and user hasn't explicitly set a custom icon, or if requested:
          if (updates.kind && updates.kind !== b.kind && !updates.icon) {
            // Keep user icon if valid, or sync with default
            if (b.icon === DEFAULT_KIND_ICONS[b.kind]) {
              updated.icon = DEFAULT_KIND_ICONS[updates.kind]
            }
          }
          return updated
        })
      )
    },
    []
  )

  const addDraftBlock = useCallback((): string => {
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const newBlock: ActivityDefinition = {
      id: newId,
      name: '',
      start: [9, 0],
      end: [10, 0],
      kind: 'study' as ActivityKind,
      icon: DEFAULT_KIND_ICONS.study,
    }

    setDraftSchedule(prev => [...prev, newBlock])
    return newId
  }, [])

  const deleteDraftBlock = useCallback((id: string) => {
    setDraftSchedule(prev => prev.filter(b => b.id !== id))
  }, [])

  return {
    activeSchedule: planner.activeSchedule,
    activePresetId: planner.activePresetId,
    defaultPresetId: planner.defaultPresetId,
    customPresets: planner.customPresets,
    allPresets,
    draftSchedule,
    editingPresetId,
    scheduleRevision,
    isDirty,
    isDraftApplied,
    validation,
    loadPreset,
    applyDraftToTimer,
    saveAsNewPreset,
    updatePreset,
    renamePreset,
    duplicatePreset,
    deletePreset,
    setAsDefault,
    loadDefault,
    loadOriginal,
    discardDraft,
    updateDraftBlock,
    addDraftBlock,
    deleteDraftBlock,
  }
}
