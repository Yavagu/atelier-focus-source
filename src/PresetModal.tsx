import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bookmark, Edit3, X } from 'lucide-react'
import type { Preset } from './schedule'
import { validatePresetName } from './validation'

export interface PresetModalProps {
  isOpen: boolean
  mode: 'save' | 'rename'
  initialName?: string
  existingPresets: Preset[]
  currentPresetId?: string
  onSubmit: (name: string) => void
  onClose: () => void
}

export function PresetModal({
  isOpen,
  mode,
  initialName = '',
  existingPresets,
  currentPresetId,
  onSubmit,
  onClose,
}: PresetModalProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, initialName])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const validation = validatePresetName(name, existingPresets, currentPresetId)
    if (!validation.isValid) {
      setError(validation.error || 'Invalid preset name.')
      return
    }
    onSubmit(name.trim())
  }

  const title = mode === 'save' ? 'Save as New Preset' : 'Rename Preset'
  const actionLabel = mode === 'save' ? 'Save Preset' : 'Save Changes'

  return (
    <div
      className="modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            {mode === 'save' ? (
              <Bookmark className="modal-icon-accent" size={18} />
            ) : (
              <Edit3 className="modal-icon-accent" size={18} />
            )}
            <h3 id="preset-modal-title" className="modal-title">
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="modal-field-label" htmlFor="preset-name-input">
              Preset Name
            </label>
            <input
              id="preset-name-input"
              ref={inputRef}
              type="text"
              className={`modal-text-input ${error ? 'input-error' : ''}`}
              placeholder="e.g. Intensive Study Day, Weekend Rhythm..."
              maxLength={40}
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (error) setError(null)
              }}
            />
            <div className="modal-field-hint">
              <span>Up to 40 characters</span>
              <span>{name.trim().length} / 40</span>
            </div>
            {error && <div className="modal-error-message">{error}</div>}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-secondary-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="modal-primary-btn">
              {actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
