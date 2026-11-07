import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AlertCircle, ChevronDown, Music, Play, Square, Trash2 } from 'lucide-react'
import { ActivityIcon, IconPickerPopover, type IconKey } from './ActivityIcon'
import { audioEngine } from './audioEngine'
import {
  getActivityDurationMinutes,
  getKindColors,
  isOvernight,
  type ActivityDefinition,
  type ActivityKind,
  type ThemeId,
} from './schedule'
import {
  DEFAULT_TUNE_ID,
  TUNE_REGISTRY,
  type TuneId,
} from './sessionTunes'
import { TunePickerPopover } from './TunePickerPopover'

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
  const [showTunePicker, setShowTunePicker] = useState(false)
  const [isRowPlaying, setIsRowPlaying] = useState(false)
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const tuneBtnRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const colors = getKindColors(theme)

  const tuneId: TuneId = block.endTuneId || DEFAULT_TUNE_ID
  const tuneDef = TUNE_REGISTRY[tuneId] || TUNE_REGISTRY[DEFAULT_TUNE_ID]
  const isNone = tuneId === 'none'

  useEffect(() => {
    return audioEngine.subscribe({
      onPlayingChange: currentlyPlaying => {
        if (!currentlyPlaying) {
          setIsRowPlaying(false)
        }
      },
    })
  }, [])

  useEffect(() => {
    if (autoFocus && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [autoFocus])

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

  const handlePlayPreview = async () => {
    if (isNone) return
    if (isRowPlaying) {
      audioEngine.stopAll()
      setIsRowPlaying(false)
    } else {
      setIsRowPlaying(true)
      await audioEngine.unlockAudio()
      await audioEngine.playTune(tuneId)
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
            onClick={() => setShowIconPicker(true)}
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

        {/* End Sound Selector & Play Button */}
        <div className="activity-row-tune-col">
          <label htmlFor={`tune-${block.id}`} className="sr-only">
            End Sound
          </label>
          <div className="tune-selector-wrap">
            <button
              ref={tuneBtnRef}
              id={`tune-${block.id}`}
              type="button"
              className="tune-select-btn"
              onClick={() => setShowTunePicker(true)}
              aria-label={`Completion sound for ${block.name || 'activity'}, current: ${tuneDef.name}`}
              title="Click to select completion sound"
            >
              <Music size={12} className="tune-btn-icon" />
              <span className="tune-btn-name">{tuneDef.name}</span>
              <ChevronDown size={11} className="tune-btn-arrow" />
            </button>

            <button
              type="button"
              className={`tune-play-btn ${isRowPlaying ? 'playing' : ''}`}
              onClick={handlePlayPreview}
              disabled={isNone}
              aria-label={isNone ? 'No sound selected' : isRowPlaying ? 'Stop preview' : `Preview ${tuneDef.name}`}
              title={isNone ? 'No sound selected' : isRowPlaying ? 'Stop preview' : `Preview ${tuneDef.name}`}
            >
              {isRowPlaying ? <Square size={11} /> : <Play size={11} />}
            </button>
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
      <IconPickerPopover
        isOpen={showIconPicker}
        triggerRef={iconBtnRef}
        value={block.icon}
        categoryKind={block.kind}
        onChange={(newIcon: IconKey) => {
          onUpdate({ icon: newIcon })
        }}
        onClose={() => setShowIconPicker(false)}
      />

      {/* Tune Picker Popover */}
      <TunePickerPopover
        isOpen={showTunePicker}
        triggerRef={tuneBtnRef}
        value={tuneId}
        onChange={(newTune: TuneId) => {
          onUpdate({ endTuneId: newTune })
        }}
        onClose={() => setShowTunePicker(false)}
      />
    </div>
  )
}
