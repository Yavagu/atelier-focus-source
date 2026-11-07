export type ActivityKind = 'study' | 'break' | 'sleep' | 'routine'

export interface ActivityDefinition {
  id: string
  name: string
  start: [number, number]
  end: [number, number]
  kind: ActivityKind
  number?: number
}

export interface Segment extends ActivityDefinition {
  startMs: number
  endMs: number
}

export const DAILY_SCHEDULE: ActivityDefinition[] = [
  { id: 'wake', name: 'Wake Up & Freshen Up', start: [6, 30], end: [7, 0], kind: 'routine' },
  { id: 'study-1', name: 'Study Session 1', start: [7, 0], end: [10, 0], kind: 'study', number: 1 },
  { id: 'breakfast', name: 'Breakfast', start: [10, 0], end: [10, 30], kind: 'break' },
  { id: 'break-am', name: 'Break', start: [10, 30], end: [11, 0], kind: 'break' },
  { id: 'study-2', name: 'Study Session 2', start: [11, 0], end: [14, 0], kind: 'study', number: 2 },
  { id: 'lunch', name: 'Lunch', start: [14, 0], end: [15, 0], kind: 'break' },
  { id: 'study-3', name: 'Study Session 3', start: [15, 0], end: [18, 0], kind: 'study', number: 3 },
  { id: 'break-pm', name: 'Break', start: [18, 0], end: [19, 0], kind: 'break' },
  { id: 'study-4', name: 'Study Session 4', start: [19, 0], end: [20, 30], kind: 'study', number: 4 },
  { id: 'break-evening', name: 'Break', start: [20, 30], end: [21, 0], kind: 'break' },
  { id: 'study-5', name: 'Study Session 5', start: [21, 0], end: [23, 0], kind: 'study', number: 5 },
  { id: 'sleep', name: 'Sleep', start: [23, 0], end: [6, 30], kind: 'sleep' },
]

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

function localDate(base: Date, offset: number, hour: number, minute: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, hour, minute).getTime()
}

export function makeSegments(aroundMs: number, daysBefore = 2, daysAfter = 3): Segment[] {
  const date = new Date(aroundMs)
  const segments: Segment[] = []
  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    for (const item of DAILY_SCHEDULE) {
      const startMs = localDate(date, offset, item.start[0], item.start[1])
      const endsTomorrow = item.end[0] < item.start[0]
      const endMs = localDate(date, offset + (endsTomorrow ? 1 : 0), item.end[0], item.end[1])
      segments.push({ ...item, startMs, endMs })
    }
  }
  return segments.sort((a, b) => a.startMs - b.startMs)
}

export function getCurrentSegment(ms: number): Segment {
  const current = makeSegments(ms, 1, 1).find(segment => segment.startMs <= ms && ms < segment.endMs)
  if (!current) throw new Error('Daily schedule does not cover this timestamp')
  return current
}

export function getUpcomingSegments(ms: number, count = 3): Segment[] {
  return makeSegments(ms, 1, 2).filter(segment => segment.startMs > ms).slice(0, count)
}

export function getStudyOverview(ms: number) {
  const now = new Date(ms)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const study = makeSegments(ms, 0, 0).filter(s => s.kind === 'study' && s.startMs >= dayStart && s.endMs <= dayEnd)
  const elapsed = study.reduce((sum, s) => sum + Math.min(Math.max(ms - s.startMs, 0), s.endMs - s.startMs), 0)
  return { elapsed, remaining: Math.max(0, SCHEDULED_STUDY_MS - elapsed) }
}

// The hot path uses native local Date fields instead of constructing Intl formatters
// on every animation frame. A timezone change is therefore reflected immediately.
export function formatTime(ms: number, seconds = false) {
  const d = new Date(ms)
  const hour24 = d.getHours()
  const hour = hour24 % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, '0')
  const sec = seconds ? `:${String(d.getSeconds()).padStart(2, '0')}` : ''
  return `${hour}:${minute}${sec} ${hour24 < 12 ? 'AM' : 'PM'}`
}

export function formatRange(startMs: number, endMs: number) {
  return `${formatTime(startMs)} – ${formatTime(endMs)}`
}

export function formatDuration(ms: number, seconds = false) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (seconds) return h ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` : `${m}m ${String(s).padStart(2, '0')}s`
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export const formatClock = (ms: number) => formatTime(ms, true)

export function dayLabel(ms: number) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(ms)
}

export function shortDate(ms: number) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(ms)
}
