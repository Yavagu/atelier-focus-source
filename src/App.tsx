import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Edit,
  Palette,
  Sliders,
  Sparkles,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { ActivityIcon } from './ActivityIcon'
import { ConfirmDialog } from './ConfirmDialog'
import { EditorPage } from './EditorPage'
import {
  loadAudioSettings,
  saveAudioSettings,
  type StoredAudioSettingsV1,
} from './audioStorage'
import { useSessionEndSound } from './useSessionEndSound'
import {
  formatClock,
  formatDuration,
  formatMinutes,
  formatRange,
  formatTime,
  getActivityDurationMinutes,
  getCategoryTotals,
  getCurrentSegment,
  getKindColors,
  getNextSegment,
  getStudyOverview,
  getUpcomingSegments,
  shortDate,
  sortActivitiesChronologically,
  THEMES,
  type ActivityDefinition,
  type ActivityKind,
  type Segment,
  type ThemeId,
} from './schedule'
import TimelineInstrument from './TimelineInstrument'
import { usePlannerState } from './usePlannerState'

type Tab = 'overview' | 'schedule' | 'insights' | 'editor'

function useLocalClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 12)
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 12)
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}

function TinyHeading({
  number,
  title,
  icon,
}: {
  number: string
  title: string
  icon: React.ReactNode
}) {
  return (
    <div className="card-heading">
      <div className="card-heading-left">
        <span className="card-heading-icon">{icon}</span>
        <span>{title}</span>
      </div>
      <span className="card-number">{number}</span>
    </div>
  )
}

function ProgressCard({
  segment,
  now,
  colors,
}: {
  segment: Segment | null
  now: number
  colors: Record<ActivityKind, string>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const percentage = segment
    ? Math.max(
        0,
        Math.min(
          100,
          ((now - segment.startMs) / (segment.endMs - segment.startMs)) * 100
        )
      )
    : 0

  useEffect(() => {
    if (!segment) return
    let raf = 0
    const frame = () => {
      const value = Math.max(
        0,
        Math.min(1, (Date.now() - segment.startMs) / (segment.endMs - segment.startMs))
      )
      if (barRef.current) barRef.current.style.transform = `scaleX(${value})`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [segment])

  return (
    <motion.article
      layout
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`dashboard-card progress-card ${
        isOpen ? 'dashboard-card-expanded' : 'dashboard-card-collapsed'
      }`}
      onClick={() => {
        if (!isOpen) setIsOpen(true)
      }}
    >
      <div
        className="card-heading-trigger"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(v => !v)
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen(v => !v)
          }
        }}
      >
        <TinyHeading number="01 / 03" title="SESSION PROGRESS" icon={<Activity size={17} />} />
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="dashboard-card-content"
          >
            {segment ? (
              <div>
                <div className="current-session-label">
                  CURRENT ACTIVITY{' '}
                  <span
                    className="session-badge"
                    style={{ color: colors[segment.kind] }}
                  >
                    <span style={{ background: colors[segment.kind] }} />
                    {segment.kind.toUpperCase()}
                  </span>
                </div>
                <div className="current-session-title">{segment.name}</div>
                <div className="progress-head">
                  <span>TIME PROGRESSED</span>
                  <strong>{percentage.toFixed(1)}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`Scheduled progress through ${segment.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentage)}
                >
                  <div
                    ref={barRef}
                    className="progress-fill"
                    style={{
                      transform: `scaleX(${percentage / 100})`,
                      background: colors[segment.kind],
                    }}
                  />
                </div>
                <div className="progress-stats">
                  <div>
                    <span>ELAPSED</span>
                    <strong>{formatDuration(now - segment.startMs, true)}</strong>
                  </div>
                  <div>
                    <span>REMAINING</span>
                    <strong>{formatDuration(segment.endMs - now, true)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="free-time-progress-state">
                <div className="current-session-label">FREE TIME</div>
                <div className="current-session-title">No activity in progress</div>
                <p className="free-time-note">
                  You are currently in an unscheduled interval. Enjoy your free time until the next planned block.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

function UpNextCard({
  schedule,
  now,
  colors,
}: {
  schedule: ActivityDefinition[]
  now: number
  colors: Record<ActivityKind, string>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const upcoming = getUpcomingSegments(schedule, now, 3)

  return (
    <motion.article
      layout
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`dashboard-card upnext-card ${
        isOpen ? 'dashboard-card-expanded' : 'dashboard-card-collapsed'
      }`}
      onClick={() => {
        if (!isOpen) setIsOpen(true)
      }}
    >
      <div
        className="card-heading-trigger"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(v => !v)
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen(v => !v)
          }
        }}
      >
        <TinyHeading number="02 / 03" title="UP NEXT" icon={<Timer size={17} />} />
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="dashboard-card-content"
          >
            {upcoming.length > 0 ? (
              <div className="upnext-list">
                {upcoming.map((s, i) => (
                  <div className="upnext-item" key={`${s.startMs}-${s.id}`}>
                    <div className="upnext-time">
                      <span className="upnext-order">0{i + 1}</span>
                      <strong>{formatTime(s.startMs)}</strong>
                    </div>
                    <div
                      className="upnext-dot"
                      style={{ background: colors[s.kind] }}
                    />
                    <div className="upnext-detail">
                      <div className="upnext-name-wrap">
                        <ActivityIcon
                          icon={s.icon}
                          fallbackKind={s.kind}
                          size={12}
                          style={{ marginRight: 4, display: 'inline-block' }}
                        />
                        <strong>{s.name}</strong>
                      </div>
                      <span>{formatDuration(s.endMs - s.startMs)} scheduled</span>
                    </div>
                    <ArrowRight size={14} className="upnext-arrow" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="upnext-empty-state">
                <p>No more upcoming activities scheduled for today.</p>
              </div>
            )}
            <div className="upnext-foot">
              {upcoming.length === 1
                ? 'YOUR NEXT SCHEDULED BLOCK'
                : `YOUR NEXT ${upcoming.length} SCHEDULED BLOCKS`}{' '}
              <span>↗</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

function OverviewCard({
  schedule,
  now,
  segment,
}: {
  schedule: ActivityDefinition[]
  now: number
  segment: Segment | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const overview = getStudyOverview(schedule, now)

  const studyHours = Math.floor(overview.scheduledStudyMs / 3600000)
  const studyMins = Math.floor((overview.scheduledStudyMs % 3600000) / 60000)
  const elapsedPercent =
    overview.scheduledStudyMs > 0
      ? Math.min(100, (overview.elapsed / overview.scheduledStudyMs) * 100)
      : 0
  const remainingPercent =
    overview.scheduledStudyMs > 0
      ? Math.min(100, (overview.remaining / overview.scheduledStudyMs) * 100)
      : 0

  const studySessionDisplay =
    overview.totalStudySessions > 0
      ? segment?.kind === 'study' && segment.studyNumber
        ? `0${segment.studyNumber} / 0${overview.totalStudySessions}`
        : `— / 0${overview.totalStudySessions}`
      : '0 / 0'

  return (
    <motion.article
      layout
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`dashboard-card today-card ${
        isOpen ? 'dashboard-card-expanded' : 'dashboard-card-collapsed'
      }`}
      onClick={() => {
        if (!isOpen) setIsOpen(true)
      }}
    >
      <div
        className="card-heading-trigger"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(v => !v)
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen(v => !v)
          }
        }}
      >
        <TinyHeading number="03 / 03" title="TODAY'S OVERVIEW" icon={<TrendingUp size={17} />} />
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="dashboard-card-content"
          >
            <div>
              <div className="overview-main-label">TOTAL SCHEDULED STUDY</div>
              <div className="overview-total">
                {studyHours}
                <span>h</span> {studyMins}
                <span>m</span>
                <i> / DAY</i>
              </div>
              <div className="overview-divider" />
              <div className="overview-stats">
                <div>
                  <span>ELAPSED TODAY</span>
                  <strong>{formatDuration(overview.elapsed)}</strong>
                  <div className="overview-minibar">
                    <div style={{ width: `${elapsedPercent}%` }} />
                  </div>
                </div>
                <div>
                  <span>REMAINING TODAY</span>
                  <strong>
                    {formatDuration(Math.ceil(overview.remaining / 60000) * 60000)}
                  </strong>
                  <div className="overview-minibar muted">
                    <div style={{ width: `${remainingPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="current-study-indicator">
              <span>CURRENT STUDY SESSION</span>
              <strong>{studySessionDisplay}</strong>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

function Legend({ colors }: { colors: Record<ActivityKind, string> }) {
  return (
    <div className="schedule-legend" aria-label="Schedule color legend">
      {(
        [
          ['study', 'STUDY'],
          ['break', 'BREAKS & MEALS'],
          ['sleep', 'SLEEP'],
          ['routine', 'ROUTINE'],
        ] as const
      ).map(([kind, label]) => (
        <div key={kind}>
          <span style={{ background: colors[kind] }} />
          {label}
        </div>
      ))}
    </div>
  )
}

function SchedulePage({
  schedule,
  now,
  onOverview,
  onEditSchedule,
  colors,
}: {
  schedule: ActivityDefinition[]
  now: number
  onOverview: () => void
  onEditSchedule: () => void
  colors: Record<ActivityKind, string>
}) {
  const active = getCurrentSegment(schedule, now)
  const sorted = sortActivitiesChronologically(schedule)
  const totals = getCategoryTotals(schedule)

  return (
    <section className="secondary-page">
      <div className="secondary-top">
        <div>
          <span className="eyebrow">YOUR DAILY ROUTINE</span>
          <h1>
            The complete schedule<span className="mint-period">.</span>
          </h1>
          <p>
            Every minute has its place. This timetable repeats each day in your
            device's local timezone.
          </p>
        </div>
        <div className="secondary-actions-group">
          <button className="subtle-action" onClick={onEditSchedule}>
            <Edit size={15} /> EDIT SCHEDULE
          </button>
          <button className="subtle-action" onClick={onOverview}>
            <Compass size={16} /> VIEW LIVE TIMELINE <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="schedule-summary">
        <div>
          <span>STUDY</span>
          <strong>{formatMinutes(totals.study)}</strong>
        </div>
        <div>
          <span>SLEEP</span>
          <strong>{formatMinutes(totals.sleep)}</strong>
        </div>
        <div>
          <span>BREAKS & MEALS</span>
          <strong>{formatMinutes(totals.break)}</strong>
        </div>
        <div>
          <span>ROUTINE</span>
          <strong>{formatMinutes(totals.routine)}</strong>
        </div>
        {totals.unallocated > 0 && (
          <div className="unallocated-summary-box">
            <span>UNALLOCATED</span>
            <strong>{formatMinutes(totals.unallocated)}</strong>
          </div>
        )}
      </div>

      <div className="schedule-table-head">
        <span>TIME</span>
        <span>ACTIVITY</span>
        <span>DURATION</span>
        <span>STATUS</span>
      </div>

      <div className="schedule-rows">
        {sorted.map(item => {
          const start = new Date(now)
          start.setHours(item.start[0], item.start[1], 0, 0)
          const end = new Date(now)
          end.setHours(item.end[0], item.end[1], 0, 0)
          if (
            item.end[0] < item.start[0] ||
            (item.end[0] === item.start[0] && item.end[1] < item.start[1])
          ) {
            end.setDate(end.getDate() + 1)
          }
          const isCurrent = active?.id === item.id

          return (
            <div
              className={`schedule-row ${isCurrent ? 'schedule-row-current' : ''}`}
              key={item.id}
            >
              <div className="schedule-row-time">
                {formatTime(start.getTime())} <span>—</span>{' '}
                {formatTime(end.getTime())}
              </div>
              <div className="schedule-row-activity">
                <span
                  className="schedule-row-icon"
                  style={{
                    color: colors[item.kind],
                    background: `${colors[item.kind]}17`,
                  }}
                >
                  <ActivityIcon icon={item.icon} fallbackKind={item.kind} size={15} />
                </span>
                <strong>{item.name}</strong>
              </div>
              <div className="schedule-row-duration">
                {formatDuration(end.getTime() - start.getTime())}
              </div>
              <div className="schedule-row-status">
                {isCurrent && (
                  <span className="now-pill">
                    <span /> IN PROGRESS
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="schedule-caveat">
        All figures are scheduled time, not recorded study completion. Overnight blocks continue into the following morning.
      </div>
    </section>
  )
}

function InsightsPage({
  schedule,
  now,
  colors,
}: {
  schedule: ActivityDefinition[]
  now: number
  colors: Record<ActivityKind, string>
}) {
  const overview = getStudyOverview(schedule, now)
  const totals = getCategoryTotals(schedule)
  const sessions = sortActivitiesChronologically(schedule.filter(s => s.kind === 'study'))

  const allocationItems = [
    { label: 'Study', kind: 'study' as const, minutes: totals.study, color: colors.study },
    { label: 'Sleep', kind: 'sleep' as const, minutes: totals.sleep, color: colors.sleep },
    { label: 'Breaks & meals', kind: 'break' as const, minutes: totals.break, color: colors.break },
    { label: 'Routine', kind: 'routine' as const, minutes: totals.routine, color: colors.routine },
  ]

  if (totals.unallocated > 0) {
    allocationItems.push({
      label: 'Unallocated',
      kind: 'routine' as const,
      minutes: totals.unallocated,
      color: '#475569',
    })
  }

  const maxSessionDuration = Math.max(
    ...sessions.map(s => getActivityDurationMinutes(s)),
    60
  )

  return (
    <section className="secondary-page">
      <div className="secondary-top">
        <div>
          <span className="eyebrow">PLANNED TIME / NOT PERFORMANCE</span>
          <h1>
            Time, accounted for<span className="mint-period">.</span>
          </h1>
          <p>
            A clear breakdown of your repeating 24-hour timetable. No guessed
            productivity or unrecorded completions.
          </p>
        </div>
        <div className="insights-label">
          <Sparkles size={16} /> SCHEDULE-BASED INSIGHTS
        </div>
      </div>

      <div className="insights-grid">
        <article className="dashboard-card insight-allocation">
          <TinyHeading
            number="01 / 02"
            title="DAILY TIME ALLOCATION"
            icon={<Activity size={17} />}
          />
          <h2>
            24<span>h</span> <small>planned</small>
          </h2>
          <div className="allocation-bar">
            {allocationItems.map(a => (
              <div
                key={a.label}
                style={{
                  width: `${(a.minutes / 1440) * 100}%`,
                  background: a.color,
                }}
                title={`${a.label}: ${formatDuration(a.minutes * 60000)}`}
              />
            ))}
          </div>
          <div className="allocation-list">
            {allocationItems.map(a => (
              <div key={a.label}>
                <span className="allocation-label">
                  <i style={{ background: a.color }} />
                  {a.label}
                </span>
                <strong>{formatDuration(a.minutes * 60000)}</strong>
                <span className="allocation-percent">
                  {((a.minutes / 1440) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card insight-study">
          <TinyHeading
            number="02 / 02"
            title="STUDY SESSION DISTRIBUTION"
            icon={<BookOpenText size={17} />}
          />
          <h2>
            {Math.floor(totals.study / 60)}
            <span>h</span> {String(totals.study % 60).padStart(2, '0')}
            <span>m</span> <small>scheduled study</small>
          </h2>
          <div className="session-bars">
            {sessions.length > 0 ? (
              sessions.map((s, idx) => {
                const duration = getActivityDurationMinutes(s)
                return (
                  <div className="session-bar-row" key={s.id}>
                    <div className="session-bar-label">
                      <span>SESSION 0{idx + 1} — {s.name}</span>
                      <strong>{formatDuration(duration * 60000)}</strong>
                    </div>
                    <div className="session-bar-track">
                      <div
                        style={{
                          width: `${(duration / maxSessionDuration) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="empty-study-sessions-note">
                <p>No study sessions scheduled in this timetable.</p>
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="insight-footer">
        <Clock3 size={17} />
        <span>
          As of {formatClock(now)}, {formatDuration(overview.elapsed)} of
          today's scheduled study time has passed;{' '}
          {formatDuration(Math.ceil(overview.remaining / 60000) * 60000)}{' '}
          remains on the timetable (rounded up to the next minute).
        </span>
      </div>
    </section>
  )
}

export default function App() {
  const now = useLocalClock()
  const planner = usePlannerState()
  const [tab, setTab] = useState<Tab>('overview')
  const [pendingTab, setPendingTab] = useState<Tab | null>(null)
  const [live, setLive] = useState(true)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('atelier_focus_theme') as ThemeId
    return saved === 'theme-1' || saved === 'theme-2' ? saved : 'theme-1'
  })
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)

  // Audio settings persisted across browser sessions
  const [audioSettings, setAudioSettings] = useState<StoredAudioSettingsV1>(() => loadAudioSettings())
  const [sessionToast, setSessionToast] = useState<string | null>(null)

  const handleUpdateAudioSettings = useCallback((updates: Partial<StoredAudioSettingsV1>) => {
    setAudioSettings(prev => {
      const next = { ...prev, ...updates }
      saveAudioSettings(next)
      return next
    })
  }, [])

  const handleSessionComplete = useCallback((activity: ActivityDefinition) => {
    const message = `SESSION COMPLETE — ${activity.name}`
    setSessionToast(message)
    setTimeout(() => {
      setSessionToast(prev => (prev === message ? null : prev))
    }, 4500)
  }, [])

  // Top-level session completion sound detector
  useSessionEndSound({
    schedule: planner.activeSchedule,
    enabled: audioSettings.enabled,
    volume: audioSettings.volume,
    onSessionComplete: handleSessionComplete,
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('atelier_focus_theme', theme)
  }, [theme])

  // Prevent accidental loss of unsaved changes when closing/reloading the browser
  useEffect(() => {
    if (tab !== 'editor' || !planner.isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [tab, planner.isDirty])

  useEffect(() => {
    if (!themeMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setThemeMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [themeMenuOpen])

  const handleTabChange = (targetTab: Tab) => {
    if (targetTab === tab) return
    if (tab === 'editor' && planner.isDirty) {
      setPendingTab(targetTab)
      return
    }
    setTab(targetTab)
  }

  const active = getCurrentSegment(planner.activeSchedule, now)
  const nextSegment = getNextSegment(planner.activeSchedule, now)
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const currentTheme = THEMES[theme]
  const colors = getKindColors(theme)

  const remainingMs = active
    ? Math.max(0, active.endMs - now)
    : nextSegment
    ? Math.max(0, nextSegment.startMs - now)
    : 0

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className={`site-header ${headerVisible ? '' : 'header-hidden'}`}>
        <a
          href="#overview"
          className="brand"
          onClick={e => {
            e.preventDefault()
            handleTabChange('overview')
          }}
          aria-label="Atelier Focus home"
        >
          <div className="brand-glyph">
            <span />
            <span />
            <span />
            <span />
          </div>
          <span className="brand-text">
            ATELIER <i>/</i> <em>FOCUS</em>
          </span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          {(['overview', 'schedule', 'insights', 'editor'] as const).map(name => (
            <button
              type="button"
              key={name}
              className={tab === name ? 'nav-active' : ''}
              onClick={() => handleTabChange(name)}
              aria-current={tab === name ? 'page' : undefined}
            >
              {name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </nav>

        <div className="header-right-group">
          <div className="header-date">
            <CalendarDays size={15} />
            <span>{shortDate(now)}</span>
            <i />
            <span className="header-timezone">
              {localZone.replaceAll('_', ' ')}
            </span>
          </div>

          <div className="theme-menu-container" ref={themeMenuRef}>
            <button
              type="button"
              className={`theme-button ${themeMenuOpen ? 'theme-button-open' : ''}`}
              onClick={() => setThemeMenuOpen(prev => !prev)}
              aria-expanded={themeMenuOpen}
              aria-haspopup="true"
              aria-label="Theme selector"
            >
              <Palette size={13} className="theme-btn-icon" />
              <span className="theme-btn-label">{currentTheme.name}</span>
              <span
                className="theme-btn-swatch"
                style={{ background: currentTheme.colors.study }}
              />
              <ChevronDown
                size={12}
                className={`theme-btn-arrow ${themeMenuOpen ? 'open' : ''}`}
              />
            </button>

            {themeMenuOpen && (
              <div className="theme-dropdown-menu" role="menu">
                <div className="theme-dropdown-header">SELECT THEME</div>
                {Object.values(THEMES).map(t => {
                  const isActive = theme === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      className={`theme-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setTheme(t.id)
                        setThemeMenuOpen(false)
                      }}
                    >
                      <div className="theme-item-left">
                        <div className="theme-swatches">
                          <span
                            style={{ background: t.colors.study }}
                            title="Study"
                          />
                          <span
                            style={{ background: t.colors.break }}
                            title="Break"
                          />
                          <span
                            style={{ background: t.colors.sleep }}
                            title="Sleep"
                          />
                        </div>
                        <div className="theme-item-text">
                          <strong>{t.name}</strong>
                          <span>{t.subtitle}</span>
                        </div>
                      </div>
                      {isActive && (
                        <Check size={14} className="theme-check-icon" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            className="topbar-toggle-btn"
            onClick={() => setHeaderVisible(false)}
            aria-label="Hide top bar"
            title="Hide top bar"
          >
            <ChevronUp size={15} />
          </button>
        </div>
      </header>

      {!headerVisible && (
        <button
          type="button"
          className="topbar-reveal-btn"
          onClick={() => setHeaderVisible(true)}
          aria-label="Show top bar"
          title="Show top bar"
        >
          <ChevronDown size={14} />
          <span>SHOW BAR</span>
        </button>
      )}

      <main className="main-content" id="overview">
        <AnimatePresence mode="wait" initial={false}>
          {tab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              <div className="top-context">
                <span>
                  <span className="top-context-line" /> YOUR DAY, IN REAL TIME
                </span>
                <div className="top-context-right">
                  <button
                    type="button"
                    className="overview-customize-shortcut"
                    onClick={() => handleTabChange('editor')}
                    title="Customize daily schedule in the Editor"
                  >
                    <Sliders size={13} />
                    <span>CUSTOMIZE</span>
                  </button>
                  <span className="context-star">✳</span>
                </div>
              </div>

              <div className="hero">
                <div className="hero-left">
                  {active ? (
                    <AnimatePresence mode="wait">
                      <motion.h1
                        key={`${active.id}-${active.startMs}`}
                        initial={{ opacity: 0.6, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.24 }}
                      >
                        {active.name}
                        <span className="mint-period">.</span>
                      </motion.h1>
                    </AnimatePresence>
                  ) : (
                    <motion.h1
                      initial={{ opacity: 0.6, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24 }}
                    >
                      Free Time<span className="mint-period">.</span>
                    </motion.h1>
                  )}

                  <div className="hero-sub">
                    {active ? (
                      <>
                        <span
                          className="hero-sub-icon"
                          style={{ color: colors[active.kind] }}
                        >
                          <ActivityIcon
                            icon={active.icon}
                            fallbackKind={active.kind}
                            size={15}
                          />
                        </span>
                        <span>{formatRange(active.startMs, active.endMs)}</span>
                        <span className="hero-sub-separator" />
                        <span>
                          {formatDuration(active.endMs - active.startMs)} block
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="hero-sub-freetime-tag">
                          NO ACTIVITY SCHEDULED
                        </span>
                        {nextSegment && (
                          <>
                            <span className="hero-sub-separator" />
                            <span>
                              Next: {nextSegment.name} at{' '}
                              {formatTime(nextSegment.startMs)}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="hero-right">
                  <strong className="hero-countdown">
                    {formatDuration(remainingMs, true)}
                  </strong>
                  <span className="hero-countdown-caption">
                    {active
                      ? 'REMAINING IN CURRENT ACTIVITY'
                      : 'UNTIL NEXT ACTIVITY'}
                  </span>
                </div>
              </div>

              <TimelineInstrument
                schedule={planner.activeSchedule}
                scheduleRevision={planner.scheduleRevision}
                live={live}
                onLiveChange={setLive}
                theme={theme}
              />

              <div className="between-panels">
                <Legend colors={colors} />
                <div className="between-message">
                  <Check size={12} /> SYNCED TO YOUR LOCAL TIME
                </div>
              </div>

              <div className="dashboard-grid">
                <ProgressCard segment={active} now={now} colors={colors} />
                <UpNextCard
                  schedule={planner.activeSchedule}
                  now={now}
                  colors={colors}
                />
                <OverviewCard
                  schedule={planner.activeSchedule}
                  now={now}
                  segment={active}
                />
              </div>

              <div className="footnote">
                <span>ATELIER / FOCUS <i>©</i> THE DISCIPLINE OF TIME</span>
                <span>
                  ALL TIME METRICS ARE SCHEDULED, NOT RECORDED PRODUCTIVITY
                </span>
              </div>
            </motion.div>
          ) : tab === 'schedule' ? (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <SchedulePage
                schedule={planner.activeSchedule}
                now={now}
                onOverview={() => setTab('overview')}
                onEditSchedule={() => setTab('editor')}
                colors={colors}
              />
            </motion.div>
          ) : tab === 'insights' ? (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <InsightsPage
                schedule={planner.activeSchedule}
                now={now}
                colors={colors}
              />
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <EditorPage
                planner={planner}
                theme={theme}
                audioSettings={audioSettings}
                onUpdateAudioSettings={handleUpdateAudioSettings}
                onApplySuccess={() => setTab('overview')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Confirmation Dialog when navigating away with unsaved editor changes */}
      <ConfirmDialog
        isOpen={pendingTab !== null}
        title="Unsaved Changes"
        message="You have unsaved changes in the schedule editor. Discard changes and leave the editor?"
        confirmText="Discard & Leave"
        cancelText="Stay on Editor"
        isDestructive={true}
        onConfirm={() => {
          if (pendingTab) {
            planner.discardDraft()
            setTab(pendingTab)
            setPendingTab(null)
          }
        }}
        onCancel={() => setPendingTab(null)}
      />

      {/* Global Session Completion Notification */}
      {sessionToast && (
        <div className="session-complete-toast" role="status" aria-live="polite">
          <Sparkles size={15} className="session-toast-icon" />
          <span>{sessionToast}</span>
        </div>
      )}
    </div>
  )
}
