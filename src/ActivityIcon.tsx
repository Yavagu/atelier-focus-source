import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Activity,
  AlarmClock,
  BedDouble,
  BookOpenText,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Code2,
  Coffee,
  Compass,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Laptop,
  Moon,
  Music,
  PenLine,
  Search,
  Sparkles,
  Sun,
  Sunrise,
  Timer,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityKind } from './schedule'

export const SUPPORTED_ICON_KEYS = [
  'BookOpenText',
  'Coffee',
  'Moon',
  'Sun',
  'Sunrise',
  'AlarmClock',
  'Clock3',
  'Utensils',
  'BedDouble',
  'Laptop',
  'Code2',
  'Brain',
  'PenLine',
  'GraduationCap',
  'Dumbbell',
  'HeartPulse',
  'BriefcaseBusiness',
  'Music',
  'Gamepad2',
  'Sparkles',
  'Timer',
  'Activity',
  'CalendarDays',
  'Compass',
] as const

export type IconKey = (typeof SUPPORTED_ICON_KEYS)[number]

export interface IconMeta {
  key: IconKey
  label: string
  component: LucideIcon
  keywords: string[]
}

export const ICON_REGISTRY: Record<IconKey, IconMeta> = {
  BookOpenText: {
    key: 'BookOpenText',
    label: 'Book / Reading',
    component: BookOpenText,
    keywords: ['book', 'reading', 'study', 'literature', 'learn', 'text'],
  },
  Coffee: {
    key: 'Coffee',
    label: 'Coffee / Break',
    component: Coffee,
    keywords: ['coffee', 'tea', 'break', 'cafe', 'drink', 'relax', 'pause'],
  },
  Moon: {
    key: 'Moon',
    label: 'Moon / Sleep',
    component: Moon,
    keywords: ['moon', 'night', 'sleep', 'bed', 'rest', 'evening'],
  },
  Sun: {
    key: 'Sun',
    label: 'Sun / Routine',
    component: Sun,
    keywords: ['sun', 'day', 'morning', 'routine', 'light', 'wake'],
  },
  Sunrise: {
    key: 'Sunrise',
    label: 'Sunrise / Dawn',
    component: Sunrise,
    keywords: ['sunrise', 'dawn', 'early', 'morning', 'wake', 'start'],
  },
  AlarmClock: {
    key: 'AlarmClock',
    label: 'Alarm Clock',
    component: AlarmClock,
    keywords: ['alarm', 'clock', 'wake', 'alert', 'time'],
  },
  Clock3: {
    key: 'Clock3',
    label: 'Clock',
    component: Clock3,
    keywords: ['clock', 'time', 'hour', 'schedule', 'timing'],
  },
  Utensils: {
    key: 'Utensils',
    label: 'Meals / Dining',
    component: Utensils,
    keywords: ['food', 'meal', 'lunch', 'dinner', 'breakfast', 'eat', 'fork', 'knife'],
  },
  BedDouble: {
    key: 'BedDouble',
    label: 'Bed / Deep Sleep',
    component: BedDouble,
    keywords: ['bed', 'sleep', 'nap', 'rest', 'hotel'],
  },
  Laptop: {
    key: 'Laptop',
    label: 'Laptop / Work',
    component: Laptop,
    keywords: ['laptop', 'computer', 'work', 'office', 'screen', 'tech'],
  },
  Code2: {
    key: 'Code2',
    label: 'Code / Programming',
    component: Code2,
    keywords: ['code', 'developer', 'programming', 'software', 'tech', 'coding'],
  },
  Brain: {
    key: 'Brain',
    label: 'Brain / Deep Work',
    component: Brain,
    keywords: ['brain', 'focus', 'deep work', 'thinking', 'mind', 'intellect'],
  },
  PenLine: {
    key: 'PenLine',
    label: 'Writing / Journaling',
    component: PenLine,
    keywords: ['pen', 'write', 'journal', 'notes', 'essay', 'draft'],
  },
  GraduationCap: {
    key: 'GraduationCap',
    label: 'Academics / Lecture',
    component: GraduationCap,
    keywords: ['graduation', 'cap', 'school', 'university', 'lecture', 'degree', 'course'],
  },
  Dumbbell: {
    key: 'Dumbbell',
    label: 'Fitness / Gym',
    component: Dumbbell,
    keywords: ['gym', 'workout', 'fitness', 'exercise', 'weights', 'training'],
  },
  HeartPulse: {
    key: 'HeartPulse',
    label: 'Health / Cardio',
    component: HeartPulse,
    keywords: ['heart', 'health', 'cardio', 'pulse', 'running', 'vitality'],
  },
  BriefcaseBusiness: {
    key: 'BriefcaseBusiness',
    label: 'Business / Meeting',
    component: BriefcaseBusiness,
    keywords: ['briefcase', 'business', 'job', 'work', 'meeting', 'career'],
  },
  Music: {
    key: 'Music',
    label: 'Music / Audio',
    component: Music,
    keywords: ['music', 'audio', 'sound', 'listen', 'relax', 'playlist'],
  },
  Gamepad2: {
    key: 'Gamepad2',
    label: 'Gaming / Play',
    component: Gamepad2,
    keywords: ['game', 'gaming', 'play', 'controller', 'fun', 'entertainment'],
  },
  Sparkles: {
    key: 'Sparkles',
    label: 'Inspiration / Creative',
    component: Sparkles,
    keywords: ['sparkles', 'magic', 'creative', 'design', 'art', 'inspiration'],
  },
  Timer: {
    key: 'Timer',
    label: 'Timer / Sprint',
    component: Timer,
    keywords: ['timer', 'stopwatch', 'sprint', 'pomodoro', 'countdown'],
  },
  Activity: {
    key: 'Activity',
    label: 'Movement / Activity',
    component: Activity,
    keywords: ['activity', 'movement', 'pulse', 'action', 'motion'],
  },
  CalendarDays: {
    key: 'CalendarDays',
    label: 'Planning / Calendar',
    component: CalendarDays,
    keywords: ['calendar', 'plan', 'date', 'agenda', 'schedule', 'days'],
  },
  Compass: {
    key: 'Compass',
    label: 'Exploration / Walk',
    component: Compass,
    keywords: ['compass', 'direction', 'walk', 'outdoor', 'explore', 'navigation'],
  },
}

export const DEFAULT_KIND_ICONS: Record<ActivityKind, IconKey> = {
  study: 'BookOpenText',
  break: 'Coffee',
  sleep: 'Moon',
  routine: 'Sun',
}

export function isIconKey(value: unknown): value is IconKey {
  return typeof value === 'string' && value in ICON_REGISTRY
}

export interface ActivityIconProps {
  icon?: IconKey | string
  fallbackKind?: ActivityKind
  size?: number
  className?: string
  style?: CSSProperties
}

export function ActivityIcon({
  icon,
  fallbackKind = 'routine',
  size = 16,
  className,
  style,
}: ActivityIconProps) {
  const resolvedKey: IconKey = isIconKey(icon)
    ? icon
    : DEFAULT_KIND_ICONS[fallbackKind] || 'Sun'
  const Component = ICON_REGISTRY[resolvedKey]?.component || Sun

  return <Component size={size} className={className} style={style} aria-hidden="true" />
}

export interface IconPickerProps {
  value: IconKey
  onChange: (key: IconKey) => void
  onClose?: () => void
  categoryKind?: ActivityKind
}

export function IconPicker({ value, onChange, onClose, categoryKind }: IconPickerProps) {
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const filteredIcons = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SUPPORTED_ICON_KEYS
    return SUPPORTED_ICON_KEYS.filter(key => {
      const meta = ICON_REGISTRY[key]
      if (meta.key.toLowerCase().includes(q)) return true
      if (meta.label.toLowerCase().includes(q)) return true
      return meta.keywords.some(k => k.includes(q))
    })
  }, [query])

  return (
    <div className="icon-picker-panel" role="dialog" aria-modal="true" aria-label="Select icon">
      <div className="icon-picker-header">
        <label htmlFor={searchId} className="icon-picker-search-wrap">
          <Search size={14} className="icon-picker-search-icon" />
          <input
            id={searchId}
            ref={searchInputRef}
            type="text"
            className="icon-picker-search-input"
            placeholder="Search icons (e.g. gym, code, meal)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onClose?.()
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="icon-picker-search-clear"
              onClick={() => {
                setQuery('')
                searchInputRef.current?.focus()
              }}
              aria-label="Clear icon search"
            >
              <X size={13} />
            </button>
          )}
        </label>
        {onClose && (
          <button
            type="button"
            className="icon-picker-close-btn"
            onClick={onClose}
            aria-label="Close icon picker"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="icon-picker-grid" role="listbox" aria-label="Available icons">
        {filteredIcons.length === 0 ? (
          <div className="icon-picker-empty">No matching icons found</div>
        ) : (
          filteredIcons.map(key => {
            const meta = ICON_REGISTRY[key]
            const isSelected = value === key
            const isDefaultKind = categoryKind && DEFAULT_KIND_ICONS[categoryKind] === key

            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`icon-picker-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(key)
                  onClose?.()
                }}
                title={meta.label}
              >
                <meta.component size={20} className="icon-picker-svg" />
                <span className="icon-picker-option-label">{meta.label}</span>
                {isDefaultKind && <span className="icon-picker-kind-tag">Default</span>}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
