import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AlertCircle, ChevronDown, Trash2 } from 'lucide-react'
import { ActivityIcon, IconPicker, type IconKey } from './ActivityIcon'
import {
  getActivityDurationMinutes,
  getKindColors,
  isOvernight,
  type ActivityDefinition,
  type ActivityKind,
  type ThemeId,
} from './schedule'

interface ActivityEditorRowProps {
  block: ActivityDefinition
  errors?: string[]
  theme?: ThemeId
  autoFocus?: boolean
  onUpdate: (updates: Partial<ActivityDefinition>) => void
  onDelete: () => void
}

const CATEGORY_OPTIONS: Array<{ kind: ActivityKind; label: string }> = [
  { kind: 'study', label: 'Study' },
  { kind: 'break', label: 'Break' },
  { kind: 'sleep', label: 'Sleep' },
  { kind: 'routine', label: 'Routine' },
]

function formatTimeInput(h: number, m: number): string {
  if (h < 0 || m < 0) return ''
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseTimeInput(val: string): [number, number] | null {
  if (!val) return null
  const parts = val.split(':')
  if (parts.length !== 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return [h, m]
}

export function ActivityEditorRow({
  block,
  errors = [],
  theme = 'theme-1',
  autoFocus = false,
  onUpdate,
  onDelete,
}: ActivityEditorRowProps) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [iconPickerPos, setIconPickerPos] = useState({ top: 0, left: 0 })
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const colors = getKindColors(theme)

  useEffect(() => {
    if (autoFocus && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [autoFocus])

  const openIconPicker = () => {
    if (iconBtnRef.current) {
      const rect = iconBtnRef.current.getBoundingClientRect()
      setIconPickerPos({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - 340)),
      })
    }
    setShowIconPicker(true)
  }

  const durationMinutes = getActivityDurationMinutes(block)
  const overnight = isOvernight(block.start, block.end)
  const categoryColor = colors[block.kind] || '#81998b'

  const startTimeStr = formatTimeInput(block.start[0], block.start[1])
  const endTimeStr = formatTimeInput(block.end[0], block.end[1])

  const handleStartTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseTimeInput(e.target.value)
    if (parsed) {
      onUpdate({ start: parsed })
    }
  }

  const handleEndTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseTimeInput(e.target.value)
    if (parsed) {
      onUpdate({ end: parsed })
    }
  }

  const hasErrors = errors.length > 0

  return (
    <div className={`activity-editor-row ${hasErrors ? 'row-has-errors' : ''}`}>
      <div className="activity-row-main">
        {/* Icon selector button */}
        <div className="activity-row-icon-col">
          <button
            ref={iconBtnRef}
            type="button"
            className="activity-icon-btn"
            style={{ color: categoryColor, borderColor: `${categoryColor}40` }}
            onClick={openIconPicker}
            aria-label={`Change icon for ${block.name || 'activity'}, current icon: ${block.icon}`}
            title="Click to change icon"
          >
            <ActivityIcon icon={block.icon} fallbackKind={block.kind} size={18} />
          </button>
        </div>

        {/* Activity Name Input */}
        <div className="activity-row-name-col">
          <label htmlFor={`name-${block.id}`} className="sr-only">
            Activity Name
          </label>
          <input
            id={`name-${block.id}`}
            ref={nameInputRef}
            type="text"
            className="activity-name-input"
            placeholder="Activity name (e.g. Deep Work, Gym)..."
            value={block.name}
            maxLength={60}
            onChange={e => onUpdate({ name: e.target.value })}
          />
        </div>

        {/* Category selector */}
        <div className="activity-row-kind-col">
          <label htmlFor={`kind-${block.id}`} className="sr-only">
            Category
          </label>
          <div className="category-select-wrap">
            <span
              className="category-dot"
              style={{ background: categoryColor }}
            />
            <select
              id={`kind-${block.id}`}
              className="category-select"
              value={block.kind}
              onChange={e =>
                onUpdate({ kind: e.target.value as ActivityKind })
              }
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.kind} value={opt.kind}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="category-select-arrow" />
          </div>
        </div>

        {/* Time inputs & duration */}
        <div className="activity-row-times-col">
          <div className="time-input-group">
            <label htmlFor={`start-${block.id}`} className="time-label">
              Start
            </label>
            <input
              id={`start-${block.id}`}
              type="time"
              className="time-input"
              value={startTimeStr}
              onChange={handleStartTimeChange}
              required
            />
          </div>

          <span className="time-separator">—</span>

          <div className="time-input-group">
            <label htmlFor={`end-${block.id}`} className="time-label">
              End
            </label>
            <input
              id={`end-${block.id}`}
              type="time"
              className="time-input"
              value={endTimeStr}
              onChange={handleEndTimeChange}
              required
            />
          </div>

          <div className="activity-row-duration" title={overnight ? 'Crosses midnight into following day' : undefined}>
            <span className="duration-pill">
              {Math.floor(durationMinutes / 60)}h{' '}
              {String(durationMinutes % 60).padStart(2, '0')}m
              {overnight && <span className="overnight-tag">+1d</span>}
            </span>
          </div>
        </div>

        {/* Delete row button */}
        <div className="activity-row-action-col">
          <button
            type="button"
            className="activity-delete-btn"
            onClick={onDelete}
            aria-label={`Delete activity ${block.name || 'unnamed'}`}
            title="Delete activity"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Inline validation errors */}
      {hasErrors && (
        <div className="activity-row-errors" role="alert">
          {errors.map((err, i) => (
            <div key={i} className="row-error-item">
              <AlertCircle size={13} className="error-icon" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Icon Picker Popover */}
      {showIconPicker && (
        <>
          <div
            className="icon-picker-backdrop"
            onClick={() => setShowIconPicker(false)}
          />
          <div
            className="icon-picker-popover-anchor"
            style={{ top: `${iconPickerPos.top}px`, left: `${iconPickerPos.left}px` }}
          >
            <IconPicker
              value={block.icon}
              categoryKind={block.kind}
              onChange={(newIcon: IconKey) => {
                onUpdate({ icon: newIcon })
                setShowIconPicker(false)
              }}
              onClose={() => setShowIconPicker(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}
