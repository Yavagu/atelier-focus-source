import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Edit3,
  MoreVertical,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react'
import { ActivityEditorRow } from './ActivityEditorRow'
import { ConfirmDialog } from './ConfirmDialog'
import { PresetModal } from './PresetModal'
import { SchedulePreview } from './SchedulePreview'
import {
  ATELIER_ORIGINAL_PRESET,
  formatMinutes,
  getCategoryTotals,
  type ThemeId,
} from './schedule'
import type { PlannerState } from './usePlannerState'

interface EditorPageProps {
  planner: PlannerState
  theme?: ThemeId
  onApplySuccess?: () => void
}

export function EditorPage({
  planner,
  theme = 'theme-1',
  onApplySuccess,
}: EditorPageProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev))
    }, 3200)
  }

  // Active loaded preset
  const loadedPreset = useMemo(() => {
    return (
      planner.allPresets.find(p => p.id === planner.editingPresetId) ||
      ATELIER_ORIGINAL_PRESET
    )
  }, [planner.allPresets, planner.editingPresetId])

  const isBuiltIn = loadedPreset.isBuiltIn ?? (loadedPreset.id === ATELIER_ORIGINAL_PRESET.id)
  const isDefault = loadedPreset.id === planner.defaultPresetId
  const isActiveOnTimer =
    loadedPreset.id === planner.activePresetId && planner.isDraftApplied

  // Summary statistics calculated live from draftSchedule
  const summaryTotals = useMemo(() => {
    return getCategoryTotals(planner.draftSchedule)
  }, [planner.draftSchedule])

  const invalidBlockIds = useMemo(() => {
    return new Set(Object.keys(planner.validation.blockErrors))
  }, [planner.validation.blockErrors])

  // Preset switching with unsaved changes confirmation
  const handleSelectPreset = (presetId: string) => {
    if (presetId === planner.editingPresetId) return

    if (planner.isDirty) {
      setPendingPresetId(presetId)
      return
    }

    planner.loadPreset(presetId)
  }

  const handleApplyToTimer = () => {
    const result = planner.applyDraftToTimer()
    if (result.success) {
      showToast('Schedule applied successfully to timer.')
      onApplySuccess?.()
    } else {
      showToast(result.error || 'Failed to apply schedule.')
    }
  }

  const handleSaveAsNew = (name: string) => {
    const result = planner.saveAsNewPreset(name)
    if (result.success) {
      setSaveModalOpen(false)
      showToast(`Preset "${name}" saved successfully.`)
    } else {
      showToast(result.error || 'Failed to save preset.')
    }
  }

  const handleUpdateExisting = () => {
    if (!planner.editingPresetId || isBuiltIn) return
    const result = planner.updatePreset(planner.editingPresetId)
    if (result.success) {
      showToast(`Preset "${loadedPreset.name}" updated.`)
    } else {
      showToast(result.error || 'Failed to update preset.')
    }
  }

  const handleRenamePreset = (newName: string) => {
    if (!planner.editingPresetId || isBuiltIn) return
    const result = planner.renamePreset(planner.editingPresetId, newName)
    if (result.success) {
      setRenameModalOpen(false)
      showToast(`Preset renamed to "${newName}".`)
    } else {
      showToast(result.error || 'Failed to rename preset.')
    }
  }

  const handleDuplicatePreset = () => {
    if (!planner.editingPresetId) return
    const result = planner.duplicatePreset(planner.editingPresetId)
    if (result.success) {
      showToast('Preset duplicated successfully.')
      setActionsMenuOpen(false)
    } else {
      showToast(result.error || 'Failed to duplicate preset.')
    }
  }

  const handleDeletePreset = () => {
    if (!planner.editingPresetId || isBuiltIn) return
    const name = loadedPreset.name
    const result = planner.deletePreset(planner.editingPresetId)
    if (result.success) {
      setDeleteConfirmOpen(false)
      setActionsMenuOpen(false)
      showToast(`Preset "${name}" deleted.`)
    } else {
      showToast(result.error || 'Failed to delete preset.')
    }
  }

  const handleSetDefault = () => {
    if (!planner.editingPresetId) return
    const result = planner.setAsDefault(planner.editingPresetId)
    if (result.success) {
      showToast(`"${loadedPreset.name}" set as your default preset.`)
      setActionsMenuOpen(false)
    }
  }

  const handleLoadDefaultClick = () => {
    if (planner.isDirty) {
      setPendingAction(() => () => planner.loadDefault())
      return
    }
    planner.loadDefault()
  }

  const handleLoadOriginalClick = () => {
    if (planner.isDirty) {
      setPendingAction(() => () => planner.loadOriginal())
      return
    }
    planner.loadOriginal()
  }

  const handleDiscardClick = () => {
    if (planner.isDirty) {
      setDiscardConfirmOpen(true)
    } else {
      planner.discardDraft()
    }
  }

  const handleAddBlock = () => {
    const id = planner.addDraftBlock()
    setNewlyAddedId(id)
  }

  return (
    <section className="secondary-page editor-page" aria-label="Daily Schedule Editor">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="editor-toast" role="status" aria-live="polite">
          <Check size={14} className="toast-check" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Heading */}
      <div className="secondary-top editor-heading-row">
        <div>
          <span className="eyebrow">DESIGN YOUR DAY</span>
          <h1>
            Your time, your design<span className="mint-period">.</span>
          </h1>
          <p>
            Build a daily rhythm that works for you. Customize every activity,
            save your favorite routines, and bring them to life on your focus
            timeline.
          </p>
        </div>
        <div className="storage-local-notice" title="Changes remain in this browser's local storage">
          <Clock3 size={13} />
          <span>Your schedules are saved locally in this browser.</span>
        </div>
      </div>

      {/* SECTION A: PRESET MANAGER */}
      <div className="editor-card preset-manager-panel" aria-label="Preset Manager">
        <div className="preset-manager-header">
          <div className="preset-info-left">
            <span className="preset-eyebrow">ACTIVE PRESET</span>
            <div className="preset-title-wrap">
              <h2 className="preset-current-name">{loadedPreset.name}</h2>
              <div className="preset-badges">
                {isBuiltIn ? (
                  <span className="badge-pill badge-builtin">BUILT-IN</span>
                ) : (
                  <span className="badge-pill badge-custom">CUSTOM</span>
                )}
                {isDefault && (
                  <span className="badge-pill badge-default">
                    <Star size={11} className="badge-icon" /> DEFAULT
                  </span>
                )}
                {isActiveOnTimer && (
                  <span className="badge-pill badge-active">
                    <Zap size={11} className="badge-icon" /> APPLIED TO TIMER
                  </span>
                )}
                {!planner.isDraftApplied && (
                  <span className="badge-pill badge-warning">NOT YET APPLIED</span>
                )}
                {planner.isDirty && (
                  <span className="badge-pill badge-dirty">UNSAVED DRAFT</span>
                )}
              </div>
            </div>
          </div>

          {/* Preset Selector Dropdown */}
          <div className="preset-selector-group">
            <label htmlFor="preset-select" className="sr-only">
              Switch Preset
            </label>
            <div className="preset-select-wrap">
              <select
                id="preset-select"
                className="preset-select-input"
                value={loadedPreset.id}
                onChange={e => handleSelectPreset(e.target.value)}
              >
                <optgroup label="Built-in Presets">
                  <option value={ATELIER_ORIGINAL_PRESET.id}>
                    Atelier Original (Built-in)
                  </option>
                </optgroup>
                {planner.customPresets.length > 0 && (
                  <optgroup label="Your Saved Presets">
                    {planner.customPresets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown size={14} className="preset-select-arrow" />
            </div>
          </div>
        </div>

        {/* Preset Action Bar */}
        <div className="preset-actions-bar">
          <div className="preset-actions-left">
            <button
              type="button"
              className="preset-btn preset-btn-primary"
              onClick={() => setSaveModalOpen(true)}
              title="Save current draft as a new reusable preset"
            >
              <Bookmark size={14} />
              <span>SAVE AS NEW PRESET</span>
            </button>

            {!isBuiltIn && (
              <button
                type="button"
                className="preset-btn"
                onClick={handleUpdateExisting}
                title="Update this saved preset with the current draft"
              >
                <Check size={14} />
                <span>UPDATE PRESET</span>
              </button>
            )}

            <div className="preset-more-actions-container">
              <button
                type="button"
                className="preset-btn preset-btn-icon"
                onClick={() => setActionsMenuOpen(prev => !prev)}
                aria-expanded={actionsMenuOpen}
                aria-haspopup="true"
                aria-label="More preset actions"
                title="More preset actions"
              >
                <MoreVertical size={15} />
              </button>

              {actionsMenuOpen && (
                <>
                  <div
                    className="actions-menu-backdrop"
                    onClick={() => setActionsMenuOpen(false)}
                  />
                  <div className="preset-dropdown-menu" role="menu">
                    {!isBuiltIn && (
                      <button
                        type="button"
                        className="preset-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setActionsMenuOpen(false)
                          setRenameModalOpen(true)
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Rename Preset</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="preset-menu-item"
                      role="menuitem"
                      onClick={handleDuplicatePreset}
                    >
                      <Copy size={13} />
                      <span>Duplicate Preset</span>
                    </button>

                    {!isDefault && (
                      <button
                        type="button"
                        className="preset-menu-item"
                        role="menuitem"
                        onClick={handleSetDefault}
                      >
                        <Star size={13} />
                        <span>Set as Default Preset</span>
                      </button>
                    )}

                    {!isBuiltIn && (
                      <button
                        type="button"
                        className="preset-menu-item menu-item-danger"
                        role="menuitem"
                        onClick={() => {
                          setActionsMenuOpen(false)
                          setDeleteConfirmOpen(true)
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Preset</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="preset-shortcuts-right">
            <button
              type="button"
              className="preset-link-btn"
              onClick={handleLoadDefaultClick}
              title="Load your default preset into the editor draft"
            >
              <Star size={12} />
              <span>LOAD MY DEFAULT</span>
            </button>
            <span className="shortcut-separator">/</span>
            <button
              type="button"
              className="preset-link-btn"
              onClick={handleLoadOriginalClick}
              title="Load Atelier Original into the editor draft"
            >
              <RotateCcw size={12} />
              <span>LOAD ATELIER ORIGINAL</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B: SCHEDULE SUMMARY */}
      <div className="schedule-summary-cards" aria-label="Draft Schedule Metrics">
        <div className="summary-card">
          <span className="summary-label">TOTAL SCHEDULED</span>
          <strong className="summary-value">
            {formatMinutes(summaryTotals.totalScheduled)}
            <small> / 24h</small>
          </strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">STUDY TIME</span>
          <strong className="summary-value">
            {formatMinutes(summaryTotals.study)}
          </strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">ACTIVITIES</span>
          <strong className="summary-value">
            {planner.draftSchedule.length}
            <small> blocks</small>
          </strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">UNALLOCATED</span>
          <strong className="summary-value">
            {formatMinutes(summaryTotals.unallocated)}
            <small> free</small>
          </strong>
        </div>
      </div>

      {/* SECTION C: VISUAL SCHEDULE PREVIEW */}
      <SchedulePreview
        schedule={planner.draftSchedule}
        theme={theme}
        invalidBlockIds={invalidBlockIds}
      />

      {/* Validation Banner if general errors exist */}
      {planner.validation.generalErrors.length > 0 && (
        <div className="editor-validation-banner" role="alert">
          <AlertCircle size={16} className="validation-banner-icon" />
          <div className="validation-banner-text">
            <strong>Schedule cannot be applied yet:</strong>
            <ul>
              {planner.validation.generalErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Overlaps summary banner if any */}
      {planner.validation.overlaps.length > 0 && (
        <div className="editor-validation-banner" role="alert">
          <AlertCircle size={16} className="validation-banner-icon" />
          <div className="validation-banner-text">
            <strong>Time conflicts detected:</strong>
            <ul>
              {planner.validation.overlaps.map((ov, i) => (
                <li key={i}>
                  "{ov.blockAName}" ({ov.timeRangeA}) overlaps with "{ov.blockBName}" ({ov.timeRangeB})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* SECTION D: TIME BLOCK EDITOR */}
      <div className="time-block-editor-section" aria-label="Time blocks list">
        <div className="editor-table-head">
          <span>ICON</span>
          <span>ACTIVITY NAME</span>
          <span>CATEGORY</span>
          <span>TIME RANGE & DURATION</span>
          <span>ACTION</span>
        </div>

        <div className="activity-rows-list">
          {planner.draftSchedule.length === 0 ? (
            <div className="editor-empty-state">
              <p>No activities scheduled yet. Add your first time block below.</p>
            </div>
          ) : (
            planner.draftSchedule.map(block => (
              <ActivityEditorRow
                key={block.id}
                block={block}
                errors={planner.validation.blockErrors[block.id]}
                theme={theme}
                autoFocus={block.id === newlyAddedId}
                onUpdate={updates => planner.updateDraftBlock(block.id, updates)}
                onDelete={() => planner.deleteDraftBlock(block.id)}
              />
            ))
          )}
        </div>

        <div className="add-block-row">
          <button
            type="button"
            className="add-block-btn"
            onClick={handleAddBlock}
            disabled={planner.draftSchedule.length >= 100}
            title="Add a new time block"
          >
            <Plus size={16} />
            <span>ADD TIME BLOCK</span>
          </button>
          {planner.draftSchedule.length >= 100 && (
            <span className="limit-reached-note">Maximum 100 blocks reached</span>
          )}
        </div>
      </div>

      {/* SECTION E: EDITOR ACTIONS (BOTTOM) */}
      <div className="editor-bottom-bar">
        <div className="bottom-bar-left">
          {planner.isDirty ? (
            <span className="dirty-indicator">
              <span className="dirty-dot" /> You have unsaved changes in this draft.
            </span>
          ) : planner.isDraftApplied ? (
            <span className="applied-indicator">
              <Check size={14} className="applied-check" /> Active on timer.
            </span>
          ) : (
            <span className="not-applied-indicator">
              Preset loaded, click Apply to Timer to activate.
            </span>
          )}
        </div>

        <div className="bottom-bar-actions">
          <button
            type="button"
            className="editor-btn-secondary"
            onClick={handleDiscardClick}
            disabled={!planner.isDirty}
            title="Revert draft changes to loaded preset"
          >
            <Undo2 size={15} />
            <span>DISCARD CHANGES</span>
          </button>

          <button
            type="button"
            className="editor-btn-primary"
            onClick={handleApplyToTimer}
            disabled={!planner.validation.isValid}
            title={
              planner.validation.isValid
                ? 'Apply this timetable to your live timer and timeline'
                : 'Fix timetable errors before applying'
            }
          >
            <Zap size={15} />
            <span>APPLY TO TIMER</span>
          </button>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <PresetModal
        isOpen={saveModalOpen}
        mode="save"
        existingPresets={planner.allPresets}
        onSubmit={handleSaveAsNew}
        onClose={() => setSaveModalOpen(false)}
      />

      <PresetModal
        isOpen={renameModalOpen}
        mode="rename"
        initialName={loadedPreset.name}
        existingPresets={planner.allPresets}
        currentPresetId={loadedPreset.id}
        onSubmit={handleRenamePreset}
        onClose={() => setRenameModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Preset"
        message={`Are you sure you want to delete "${loadedPreset.name}"? This action cannot be undone for this browser.`}
        confirmText="Delete Preset"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeletePreset}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={discardConfirmOpen}
        title="Discard Changes"
        message="Are you sure you want to discard your draft changes? All unsaved modifications will be reverted."
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        isDestructive={true}
        onConfirm={() => {
          planner.discardDraft()
          setDiscardConfirmOpen(false)
        }}
        onCancel={() => setDiscardConfirmOpen(false)}
      />

      {/* Confirm dialog when switching presets with unsaved changes */}
      <ConfirmDialog
        isOpen={pendingPresetId !== null}
        title="Unsaved Changes"
        message="You have unsaved changes in your current draft. Discard them and load the selected preset?"
        confirmText="Discard & Switch"
        cancelText="Keep Editing"
        isDestructive={true}
        onConfirm={() => {
          if (pendingPresetId) {
            planner.loadPreset(pendingPresetId)
            setPendingPresetId(null)
          }
        }}
        onCancel={() => setPendingPresetId(null)}
      />

      {/* Confirm dialog for pending load default / original actions */}
      <ConfirmDialog
        isOpen={pendingAction !== null}
        title="Unsaved Changes"
        message="You have unsaved changes in your current draft. Discard them and load the preset?"
        confirmText="Discard & Load"
        cancelText="Keep Editing"
        isDestructive={true}
        onConfirm={() => {
          if (pendingAction) {
            pendingAction()
            setPendingAction(null)
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  )
}
