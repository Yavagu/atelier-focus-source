import type { IconKey } from './ActivityIcon'
import { DEFAULT_TUNE_ID, type TuneId } from './sessionTunes'

export { DEFAULT_TUNE_ID, type TuneId }

export type ActivityKind = 'study' | 'break' | 'sleep' | 'routine'

export interface ActivityDefinition {
  id: string
  name: string
  start: [number, number] // [hour: 0..23, minute: 0..59]
  end: [number, number]   // [hour: 0..23, minute: 0..59]
  kind: ActivityKind
  icon: IconKey
  endTuneId?: TuneId
}

export interface Segment extends ActivityDefinition {
  startMs: number
  endMs: number
  studyNumber?: number
  studyTotal?: number
}

export interface Preset {
  id: string
  name: string
  blocks: ActivityDefinition[]
  createdAt: number
  updatedAt: number
  isBuiltIn?: boolean
}

export const ATELIER_ORIGINAL_SCHEDULE: ActivityDefinition[] = [
  { id: 'wake', name: 'Wake Up & Freshen Up', start: [6, 30], end: [7, 0], kind: 'routine', icon: 'Sun', endTuneId: 'soft-chime' },
  { id: 'study-1', name: 'Study Session 1', start: [7, 0], end: [10, 0], kind: 'study', icon: 'BookOpenText', endTuneId: 'soft-chime' },
  { id: 'breakfast', name: 'Breakfast', start: [10, 0], end: [10, 30], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
  { id: 'break-am', name: 'Break', start: [10, 30], end: [11, 0], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
  { id: 'study-2', name: 'Study Session 2', start: [11, 0], end: [14, 0], kind: 'study', icon: 'BookOpenText', endTuneId: 'soft-chime' },
  { id: 'lunch', name: 'Lunch', start: [14, 0], end: [15, 0], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
  { id: 'study-3', name: 'Study Session 3', start: [15, 0], end: [18, 0], kind: 'study', icon: 'BookOpenText', endTuneId: 'soft-chime' },
  { id: 'break-pm', name: 'Break', start: [18, 0], end: [19, 0], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
  { id: 'study-4', name: 'Study Session 4', start: [19, 0], end: [20, 30], kind: 'study', icon: 'BookOpenText', endTuneId: 'soft-chime' },
  { id: 'break-evening', name: 'Break', start: [20, 30], end: [21, 0], kind: 'break', icon: 'Coffee', endTuneId: 'soft-chime' },
  { id: 'study-5', name: 'Study Session 5', start: [21, 0], end: [23, 0], kind: 'study', icon: 'BookOpenText', endTuneId: 'soft-chime' },
  { id: 'sleep', name: 'Sleep', start: [23, 0], end: [6, 30], kind: 'sleep', icon: 'Moon', endTuneId: 'soft-chime' },
]

export const ATELIER_ORIGINAL_PRESET: Readonly<Preset> = Object.freeze({
  id: 'atelier-original',
  name: 'Atelier Original',
  blocks: ATELIER_ORIGINAL_SCHEDULE,
  createdAt: 0,
  updatedAt: 0,
  isBuiltIn: true,
})

// Kept for backward compatibility with existing imports
export const DAILY_SCHEDULE = ATELIER_ORIGINAL_SCHEDULE
export const SCHEDULED_STUDY_MS = 12.5 * 60 * 60 * 1000

export type ThemeId = 'theme-1' | 'theme-2'

export interface ThemeDefinition {
  id: ThemeId
  name: string
  subtitle: string
  colors: Record<ActivityKind, string>
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'theme-1': {
    id: 'theme-1',
    name: 'Theme 1',
    subtitle: 'Atelier Emerald',
    colors: {
      study: '#9be2b5',
      break: '#e7b679',
      sleep: '#91aaf1',
      routine: '#b9b1cf',
    },
  },
  'theme-2': {
    id: 'theme-2',
    name: 'Theme 2',
    subtitle: 'ArtCraft Cobalt',
    colors: {
      study: '#3b82f6',
      break: '#f59e0b',
      sleep: '#8b5cf6',
      routine: '#cbd5e1',
    },
  },
}

export const DEFAULT_THEME: ThemeId = 'theme-1'

export function getKindColors(theme: ThemeId = 'theme-1'): Record<ActivityKind, string> {
  return THEMES[theme]?.colors ?? THEMES['theme-1'].colors
}

export const KIND_COLORS = THEMES['theme-1'].colors

export function isOvernight(start: [number, number], end: [number, number]): boolean {
  return end[0] < start[0] || (end[0] === start[0] && end[1] < start[1])
}

export function getActivityDurationMinutes(activity: Pick<ActivityDefinition, 'start' | 'end'>): number {
  const startMin = activity.start[0] * 60 + activity.start[1]
  const endMin = activity.end[0] * 60 + activity.end[1]
  if (isOvernight(activity.start, activity.end)) {
    return 1440 - startMin + endMin
  }
  return endMin - startMin
}

export function sortActivitiesChronologically(activities: ActivityDefinition[]): ActivityDefinition[] {
  return [...activities].sort((a, b) => {
    const aMin = a.start[0] * 60 + a.start[1]
    const bMin = b.start[0] * 60 + b.start[1]
    return aMin - bMin
  })
}

function localDate(base: Date, offset: number, hour: number, minute: number): number {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, hour, minute).getTime()
}

export function makeSegments(
  schedule: ActivityDefinition[] = DAILY_SCHEDULE,
  aroundMs: number,
  daysBefore = 2,
  daysAfter = 3
): Segment[] {
  if (!schedule || schedule.length === 0) return []
  const sorted = sortActivitiesChronologically(schedule)
  const studyBlocks = sorted.filter(s => s.kind === 'study')
  const studyIndexMap = new Map<string, number>()
  studyBlocks.forEach((b, idx) => {
    studyIndexMap.set(b.id, idx + 1)
  })
  const studyTotal = studyBlocks.length

  const date = new Date(aroundMs)
  const segments: Segment[] = []

  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    for (const item of sorted) {
      const startMs = localDate(date, offset, item.start[0], item.start[1])
      const endsTomorrow = isOvernight(item.start, item.end)
      const endMs = localDate(date, offset + (endsTomorrow ? 1 : 0), item.end[0], item.end[1])
      const studyNumber = studyIndexMap.get(item.id)

      segments.push({
        ...item,
        startMs,
        endMs,
        studyNumber,
        studyTotal: studyTotal > 0 ? studyTotal : undefined,
      })
    }
  }

  return segments.sort((a, b) => a.startMs - b.startMs)
}

export function getCurrentSegment(
  schedule: ActivityDefinition[] = DAILY_SCHEDULE,
  ms: number
): Segment | null {
  if (!schedule || schedule.length === 0) return null
  const current = makeSegments(schedule, ms, 1, 1).find(
    segment => segment.startMs <= ms && ms < segment.endMs
  )
  return current ?? null
}

export function getUpcomingSegments(
  schedule: ActivityDefinition[] = DAILY_SCHEDULE,
  ms: number,
  count = 3
): Segment[] {
  if (!schedule || schedule.length === 0) return []
  return makeSegments(schedule, ms, 1, 2)
    .filter(segment => segment.startMs > ms)
    .slice(0, count)
}

export function getNextSegment(
  schedule: ActivityDefinition[] = DAILY_SCHEDULE,
  ms: number
): Segment | null {
  const upcoming = getUpcomingSegments(schedule, ms, 1)
  return upcoming[0] ?? null
}

export interface StudyOverviewResult {
  scheduledStudyMs: number
  elapsed: number
  remaining: number
  currentStudyNumber?: number
  totalStudySessions: number
}

export function getStudyOverview(
  schedule: ActivityDefinition[] = DAILY_SCHEDULE,
  ms: number
): StudyOverviewResult {
  const studyBlocks = schedule.filter(s => s.kind === 'study')
  const totalStudySessions = studyBlocks.length
  const scheduledStudyMinutes = studyBlocks.reduce((sum, b) => sum + getActivityDurationMinutes(b), 0)
  const scheduledStudyMs = scheduledStudyMinutes * 60 * 1000

  const now = new Date(ms)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()

  // Find all study segments overlapping today's calendar window [dayStart, dayEnd]
  const segments = makeSegments(schedule, ms, 1, 1)
  const studySegments = segments.filter(s => s.kind === 'study' && s.startMs < dayEnd && s.endMs > dayStart)

  let elapsed = 0
  for (const s of studySegments) {
    const sStart = Math.max(s.startMs, dayStart)
    const sEnd = Math.min(s.endMs, Math.min(ms, dayEnd))
    if (sEnd > sStart) {
      elapsed += sEnd - sStart
    }
  }

  const activeSegment = getCurrentSegment(schedule, ms)
  const currentStudyNumber = activeSegment?.kind === 'study' ? activeSegment.studyNumber : undefined

  return {
    scheduledStudyMs,
    elapsed,
    remaining: Math.max(0, scheduledStudyMs - elapsed),
    currentStudyNumber,
    totalStudySessions,
  }
}

export interface CategoryTotals {
  study: number
  break: number
  sleep: number
  routine: number
  unallocated: number
  totalScheduled: number
}

export function getCategoryTotals(schedule: ActivityDefinition[]): CategoryTotals {
  const totals: Record<ActivityKind, number> = {
    study: 0,
    break: 0,
    sleep: 0,
    routine: 0,
  }

  for (const block of schedule) {
    const mins = getActivityDurationMinutes(block)
    if (block.kind in totals) {
      totals[block.kind] += mins
    }
  }

  const totalScheduled = totals.study + totals.break + totals.sleep + totals.routine
  const unallocated = Math.max(0, 1440 - totalScheduled)

  return {
    ...totals,
    unallocated,
    totalScheduled,
  }
}

// Hot path uses native local Date fields
export function formatTime(ms: number, seconds = false): string {
  const d = new Date(ms)
  const hour24 = d.getHours()
  const hour = hour24 % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, '0')
  const sec = seconds ? `:${String(d.getSeconds()).padStart(2, '0')}` : ''
  return `${hour}:${minute}${sec} ${hour24 < 12 ? 'AM' : 'PM'}`
}

export function formatTimeHM(hour: number, minute: number): string {
  const hour12 = hour % 12 || 12
  const minStr = String(minute).padStart(2, '0')
  return `${hour12}:${minStr} ${hour < 12 ? 'AM' : 'PM'}`
}

export function formatRange(startMs: number, endMs: number): string {
  return `${formatTime(startMs)} – ${formatTime(endMs)}`
}

export function formatDuration(ms: number, seconds = false): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (seconds) {
    return h
      ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
      : `${m}m ${String(s).padStart(2, '0')}s`
  }
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export const formatClock = (ms: number): string => formatTime(ms, true)

export function dayLabel(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(ms)
}

export function shortDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(ms)
}
