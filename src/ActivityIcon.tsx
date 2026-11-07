import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
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

export interface PopoverCoords {
  top: number
  left: number
  placement: 'right' | 'left' | 'bottom' | 'top'
}

export function calculatePopoverCoords(
  trigger: HTMLElement,
  popover: HTMLElement | null
): PopoverCoords {
  const rect = trigger.getBoundingClientRect()
  const gap = 10
  const margin = 12
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768

  const popupWidth = popover ? popover.offsetWidth : Math.min(320, viewportWidth - margin * 2)
  const popupHeight = popover ? popover.offsetHeight : 340

  const isNarrow = viewportWidth < 640
  const roomOnRight = rect.right + gap + popupWidth <= viewportWidth - margin
  const roomOnLeft = rect.left - gap - popupWidth >= margin

  // 1. Immediately to the right of the clicked icon button, vertically aligned with the button
  if (!isNarrow && roomOnRight) {
    let top = rect.top
    if (top + popupHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - popupHeight - margin)
    }
    if (top < margin) {
      top = margin
    }
    return {
      top: Math.round(top),
      left: Math.round(rect.right + gap),
      placement: 'right',
    }
  }

  // 2. Fallback on desktop to the left if right doesn't fit
  if (!isNarrow && roomOnLeft) {
    let top = rect.top
    if (top + popupHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - popupHeight - margin)
    }
    if (top < margin) {
      top = margin
    }
    return {
      top: Math.round(top),
      left: Math.round(rect.left - gap - popupWidth),
      placement: 'left',
    }
  }

  // 3. Narrow screen (< 640px) or neither side fits: appear below the button
  const roomBelow = rect.bottom + gap + popupHeight <= viewportHeight - margin
  let top: number
  let placement: 'bottom' | 'top' = 'bottom'

  if (roomBelow || rect.top < popupHeight + gap + margin) {
    top = rect.bottom + gap
    placement = 'bottom'
  } else {
    top = Math.max(margin, rect.top - gap - popupHeight)
    placement = 'top'
  }

  if (top + popupHeight > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - popupHeight - margin)
  }

  let left = rect.left
  if (left + popupWidth > viewportWidth - margin) {
    left = viewportWidth - popupWidth - margin
  }
  if (left < margin) {
    left = margin
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
  }
}

export interface IconPickerPopoverProps extends IconPickerProps {
  isOpen: boolean
  triggerRef: RefObject<HTMLElement | null>
}

export function IconPickerPopover({
  isOpen,
  triggerRef,
  value,
  onChange,
  onClose,
  categoryKind,
}: IconPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<PopoverCoords>({
    top: 0,
    left: 0,
    placement: 'right',
  })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const next = calculatePopoverCoords(trigger, popoverRef.current)
    setCoords(next)
  }, [triggerRef])

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true })

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen, updatePosition])

  const handleClose = useCallback(() => {
    onClose?.()
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }, [onClose, triggerRef])

  const handleChange = useCallback(
    (key: IconKey) => {
      onChange(key)
      handleClose()
    },
    [onChange, handleClose]
  )

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
      }
    }

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen, handleClose, triggerRef])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className="icon-picker-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={popoverRef}
        className="icon-picker-popover-anchor"
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
        }}
        data-placement={coords.placement}
      >
        <IconPicker
          value={value}
          categoryKind={categoryKind}
          onChange={handleChange}
          onClose={handleClose}
        />
      </div>
    </>,
    document.body
  )
}
