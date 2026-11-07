import { isIconKey } from './ActivityIcon'
import type { ActivityDefinition, ActivityKind, Preset } from './schedule'
import { isTuneId } from './sessionTunes'

export interface OverlapConflict {
  blockAId: string
  blockAName: string
  blockBId: string
  blockBName: string
  timeRangeA: string
  timeRangeB: string
}

export interface ValidationResult {
  isValid: boolean
  generalErrors: string[]
  blockErrors: Record<string, string[]>
  overlaps: OverlapConflict[]
}

const VALID_KINDS: Set<ActivityKind> = new Set(['study', 'break', 'sleep', 'routine'])

interface MinuteInterval {
  start: number // 0..1439
  end: number   // 1..1440
}

function getBlockIntervals(block: ActivityDefinition): MinuteInterval[] {
  const startMin = block.start[0] * 60 + block.start[1]
  const endMin = block.end[0] * 60 + block.end[1]

  if (startMin === endMin) {
    return []
  }

  if (startMin < endMin) {
    return [{ start: startMin, end: endMin }]
  }

  // Crosses midnight: [startMin, 1440) and [0, endMin)
  return [
    { start: startMin, end: 1440 },
    { start: 0, end: endMin },
  ]
}

function intervalsOverlap(i1: MinuteInterval, i2: MinuteInterval): boolean {
  const maxStart = Math.max(i1.start, i2.start)
  const minEnd = Math.min(i1.end, i2.end)
  return maxStart < minEnd
}

function formatHM(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function validateSchedule(blocks: ActivityDefinition[]): ValidationResult {
  const generalErrors: string[] = []
  const blockErrors: Record<string, string[]> = {}
  const overlaps: OverlapConflict[] = []

  const addBlockError = (id: string, msg: string) => {
    if (!blockErrors[id]) blockErrors[id] = []
    blockErrors[id].push(msg)
  }

  if (!Array.isArray(blocks) || blocks.length === 0) {
    generalErrors.push('At least one activity is required.')
    return {
      isValid: false,
      generalErrors,
      blockErrors,
      overlaps,
    }
  }

  if (blocks.length > 100) {
    generalErrors.push('A schedule cannot have more than 100 activities.')
  }

  const seenIds = new Set<string>()

  // Validate individual blocks
  blocks.forEach((block, index) => {
    const id = block?.id
    if (!id || typeof id !== 'string') {
      generalErrors.push(`Activity at index ${index} is missing a unique ID.`)
      return
    }

    if (seenIds.has(id)) {
      addBlockError(id, 'Duplicate activity ID.')
    }
    seenIds.add(id)

    // Name
    const trimmedName = typeof block.name === 'string' ? block.name.trim() : ''
    if (!trimmedName) {
      addBlockError(id, 'Activity name is required.')
    } else if (trimmedName.length > 60) {
      addBlockError(id, 'Activity name cannot exceed 60 characters.')
    }

    // Kind
    if (!VALID_KINDS.has(block.kind)) {
      addBlockError(id, 'Invalid category selected.')
    }

    // Icon
    if (!isIconKey(block.icon)) {
      addBlockError(id, 'Invalid icon selected.')
    }

    // End Tune
    if (block.endTuneId !== undefined && !isTuneId(block.endTuneId)) {
      addBlockError(id, 'Invalid completion sound selected.')
    }

    // Start & End times
    const startValid =
      Array.isArray(block.start) &&
      block.start.length === 2 &&
      Number.isInteger(block.start[0]) &&
      block.start[0] >= 0 &&
      block.start[0] <= 23 &&
      Number.isInteger(block.start[1]) &&
      block.start[1] >= 0 &&
      block.start[1] <= 59

    const endValid =
      Array.isArray(block.end) &&
      block.end.length === 2 &&
      Number.isInteger(block.end[0]) &&
      block.end[0] >= 0 &&
      block.end[0] <= 23 &&
      Number.isInteger(block.end[1]) &&
      block.end[1] >= 0 &&
      block.end[1] <= 59

    if (!startValid) {
      addBlockError(id, 'Invalid start time.')
    }
    if (!endValid) {
      addBlockError(id, 'Invalid end time.')
    }

    if (startValid && endValid) {
      if (block.start[0] === block.end[0] && block.start[1] === block.end[1]) {
        addBlockError(id, 'Start and end time cannot be the same.')
      }
    }
  })

  // Pairwise overlap detection
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i]
    if (!a?.id) continue
    const intervalsA = getBlockIntervals(a)
    if (intervalsA.length === 0) continue

    for (let j = i + 1; j < blocks.length; j++) {
      const b = blocks[j]
      if (!b?.id) continue
      const intervalsB = getBlockIntervals(b)
      if (intervalsB.length === 0) continue

      let hasOverlap = false
      for (const intA of intervalsA) {
        for (const intB of intervalsB) {
          if (intervalsOverlap(intA, intB)) {
            hasOverlap = true
            break
          }
        }
        if (hasOverlap) break
      }

      if (hasOverlap) {
        const timeRangeA = `${formatHM(a.start[0], a.start[1])}–${formatHM(a.end[0], a.end[1])}`
        const timeRangeB = `${formatHM(b.start[0], b.start[1])}–${formatHM(b.end[0], b.end[1])}`
        const nameA = a.name.trim() || 'Untitled Activity'
        const nameB = b.name.trim() || 'Untitled Activity'

        overlaps.push({
          blockAId: a.id,
          blockAName: nameA,
          blockBId: b.id,
          blockBName: nameB,
          timeRangeA,
          timeRangeB,
        })

        addBlockError(a.id, `Overlaps with "${nameB}" (${timeRangeB}).`)
        addBlockError(b.id, `Overlaps with "${nameA}" (${timeRangeA}).`)
      }
    }
  }

  const hasBlockErrors = Object.keys(blockErrors).length > 0
  const isValid = generalErrors.length === 0 && !hasBlockErrors && overlaps.length === 0

  return {
    isValid,
    generalErrors,
    blockErrors,
    overlaps,
  }
}

export function validatePresetName(
  name: string,
  existingPresets: Preset[],
  currentPresetId?: string
): { isValid: boolean; error?: string } {
  const trimmed = name.trim()
  if (!trimmed) {
    return { isValid: false, error: 'Preset name is required.' }
  }
  if (trimmed.length > 40) {
    return { isValid: false, error: 'Preset name cannot exceed 40 characters.' }
  }

  const lower = trimmed.toLowerCase()
  const duplicate = existingPresets.find(
    p => p.id !== currentPresetId && p.name.trim().toLowerCase() === lower
  )

  if (duplicate) {
    return { isValid: false, error: 'A preset with this name already exists.' }
  }

  return { isValid: true }
}
