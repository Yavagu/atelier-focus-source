import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, Music, X } from 'lucide-react'
import { calculatePopoverCoords, type PopoverCoords } from './ActivityIcon'
import {
  SUPPORTED_TUNE_IDS,
  TUNE_REGISTRY,
  type TuneId,
} from './sessionTunes'

export interface TunePickerPopoverProps {
  isOpen: boolean
  triggerRef: RefObject<HTMLElement | null>
  value: TuneId
  onChange: (tuneId: TuneId) => void
  onClose: () => void
}

export function TunePickerPopover({
  isOpen,
  triggerRef,
  value,
  onChange,
  onClose,
}: TunePickerPopoverProps) {
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
    onClose()
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }, [onClose, triggerRef])

  const handleSelect = useCallback(
    (tuneId: TuneId) => {
      onChange(tuneId)
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
        className="tune-picker-popover-anchor"
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
        }}
        data-placement={coords.placement}
        role="dialog"
        aria-label="Select session completion tune"
      >
        <div className="tune-picker-panel">
          <div className="tune-picker-header">
            <div className="tune-header-title">
              <Music size={13} className="tune-header-icon" />
              <span>COMPLETION TUNE</span>
            </div>
            <button
              type="button"
              className="icon-picker-close-btn"
              onClick={handleClose}
              aria-label="Close tune selector"
            >
              <X size={14} />
            </button>
          </div>

          <div className="tune-picker-list" role="listbox" aria-label="Available melodies">
            {SUPPORTED_TUNE_IDS.map(tuneId => {
              const def = TUNE_REGISTRY[tuneId]
              const isSelected = value === tuneId

              return (
                <button
                  key={tuneId}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`tune-picker-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(tuneId)}
                >
                  <div className="tune-option-left">
                    <span className="tune-option-name">{def.name}</span>
                    <span className="tune-option-desc">{def.character}</span>
                  </div>

                  {isSelected && <Check size={14} className="tune-check-icon" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
