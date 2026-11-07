import { useMemo, useState } from 'react'
import { ActivityIcon } from './ActivityIcon'
import {
  formatDuration,
  formatTimeHM,
  getKindColors,
  isOvernight,
  type ActivityDefinition,
  type ThemeId,
} from './schedule'

interface PreviewSlice {
  key: string
  block: ActivityDefinition
  startMin: number
  endMin: number
  durationMin: number
  isSplit: boolean
  hasError: boolean
}

interface SchedulePreviewProps {
  schedule: ActivityDefinition[]
  theme?: ThemeId
  invalidBlockIds?: Set<string>
}

export function SchedulePreview({
  schedule,
  theme = 'theme-1',
  invalidBlockIds = new Set(),
}: SchedulePreviewProps) {
  const colors = getKindColors(theme)
  const [hoveredSlice, setHoveredSlice] = useState<{
    slice: PreviewSlice
    x: number
  } | null>(null)

  const slices = useMemo(() => {
    const list: PreviewSlice[] = []

    schedule.forEach(block => {
      if (
        !Array.isArray(block.start) ||
        !Array.isArray(block.end) ||
        block.start.length !== 2 ||
        block.end.length !== 2
      ) {
        return
      }

      const sMin = block.start[0] * 60 + block.start[1]
      const eMin = block.end[0] * 60 + block.end[1]
      const hasError = invalidBlockIds.has(block.id)

      if (sMin === eMin) return

      if (!isOvernight(block.start, block.end)) {
        list.push({
          key: `${block.id}-single`,
          block,
          startMin: sMin,
          endMin: eMin,
          durationMin: eMin - sMin,
          isSplit: false,
          hasError,
        })
      } else {
        // Split at midnight: [sMin, 1440) and [0, eMin)
        list.push({
          key: `${block.id}-split-evening`,
          block,
          startMin: sMin,
          endMin: 1440,
          durationMin: 1440 - sMin,
          isSplit: true,
          hasError,
        })
        list.push({
          key: `${block.id}-split-morning`,
          block,
          startMin: 0,
          endMin: eMin,
          durationMin: eMin,
          isSplit: true,
          hasError,
        })
      }
    })

    return list
  }, [schedule, invalidBlockIds])

  const timeMarkers = [
    { label: '00:00', min: 0 },
    { label: '04:00', min: 240 },
    { label: '08:00', min: 480 },
    { label: '12:00', min: 720 },
    { label: '16:00', min: 960 },
    { label: '20:00', min: 1200 },
    { label: '24:00', min: 1440 },
  ]

  return (
    <div className="schedule-preview-container" aria-label="24-hour visual schedule preview">
      <div className="schedule-preview-header">
        <span className="schedule-preview-title">24-HOUR TIMETABLE PREVIEW</span>
        <span className="schedule-preview-legend">
          <span className="preview-legend-dot" style={{ background: colors.study }} /> Study
          <span className="preview-legend-dot" style={{ background: colors.break }} /> Break
          <span className="preview-legend-dot" style={{ background: colors.sleep }} /> Sleep
          <span className="preview-legend-dot" style={{ background: colors.routine }} /> Routine
        </span>
      </div>

      <div className="schedule-preview-bar-track">
        {slices.map(slice => {
          const leftPercent = (slice.startMin / 1440) * 100
          const widthPercent = (slice.durationMin / 1440) * 100
          const color = colors[slice.block.kind] || '#81998b'
          const showLabel = widthPercent >= 5.5

          return (
            <div
              key={slice.key}
              className={`schedule-preview-slice ${slice.hasError ? 'slice-error' : ''}`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                backgroundColor: slice.hasError ? 'rgba(239, 68, 68, 0.45)' : `${color}28`,
                borderColor: slice.hasError ? '#ef4444' : `${color}88`,
                borderLeftColor: color,
              }}
              onMouseEnter={e => {
                const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                if (rect) {
                  setHoveredSlice({
                    slice,
                    x: e.clientX - rect.left,
                  })
                }
              }}
              onMouseLeave={() => setHoveredSlice(null)}
              aria-label={`${slice.block.name || 'Untitled'}: ${formatTimeHM(
                slice.block.start[0],
                slice.block.start[1]
              )} - ${formatTimeHM(slice.block.end[0], slice.block.end[1])}`}
            >
              {showLabel && (
                <div className="schedule-preview-slice-content">
                  <ActivityIcon
                    icon={slice.block.icon}
                    fallbackKind={slice.block.kind}
                    size={11}
                    className="slice-icon"
                  />
                  <span className="slice-name">{slice.block.name || 'Untitled'}</span>
                </div>
              )}
            </div>
          )
        })}

        {hoveredSlice && (
          <div
            className="schedule-preview-tooltip"
            style={{
              left: `${Math.max(60, Math.min(hoveredSlice.x, 900))}px`,
            }}
          >
            <div className="tooltip-head">
              <span
                className="tooltip-kind-swatch"
                style={{ background: colors[hoveredSlice.slice.block.kind] }}
              />
              <strong>{hoveredSlice.slice.block.name || 'Untitled Activity'}</strong>
            </div>
            <div className="tooltip-sub">
              <span>
                {formatTimeHM(
                  hoveredSlice.slice.block.start[0],
                  hoveredSlice.slice.block.start[1]
                )}{' '}
                —{' '}
                {formatTimeHM(
                  hoveredSlice.slice.block.end[0],
                  hoveredSlice.slice.block.end[1]
                )}
              </span>
              <span>
                {formatDuration(
                  hoveredSlice.slice.durationMin * 60 * 1000
                )}{' '}
                {hoveredSlice.slice.isSplit ? '(day portion)' : ''}
              </span>
            </div>
            {hoveredSlice.slice.hasError && (
              <div className="tooltip-error-tag">Has validation conflicts</div>
            )}
          </div>
        )}
      </div>

      <div className="schedule-preview-ticks">
        {timeMarkers.map(marker => (
          <div
            key={marker.label}
            className="schedule-preview-tick"
            style={{ left: `${(marker.min / 1440) * 100}%` }}
          >
            <span className="tick-line" />
            <span className="tick-label">{marker.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
