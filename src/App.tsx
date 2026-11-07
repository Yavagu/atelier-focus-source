import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowRight, BookOpenText, CalendarDays, Check, ChevronDown, ChevronUp, Clock3, Coffee, Compass, Moon, Palette, Sparkles, Sun, Timer, TrendingUp } from 'lucide-react'
import TimelineInstrument from './TimelineInstrument'
import {
  DAILY_SCHEDULE, SCHEDULED_STUDY_MS, THEMES, formatClock, formatDuration, formatRange,
  formatTime, getCurrentSegment, getKindColors, getStudyOverview, getUpcomingSegments, shortDate, type ActivityKind,
  type Segment, type ThemeId,
} from './schedule'

type Tab = 'overview' | 'schedule' | 'insights'

function useLocalClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 12)
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 12)
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return now
}

function ActivityIcon({ kind, size = 16 }: { kind: ActivityKind; size?: number }) {
  if (kind === 'study') return <BookOpenText size={size} />
  if (kind === 'break') return <Coffee size={size} />
  if (kind === 'sleep') return <Moon size={size} />
  return <Sun size={size} />
}

function TinyHeading({ number, title, icon }: { number: string; title: string; icon: React.ReactNode }) {
  return <div className="card-heading"><div className="card-heading-left"><span className="card-heading-icon">{icon}</span><span>{title}</span></div><span className="card-number">{number}</span></div>
}

function ProgressCard({ segment, now, colors }: { segment: Segment; now: number; colors: Record<ActivityKind, string> }) {
  const [isOpen, setIsOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const percentage = Math.max(0, Math.min(100, ((now - segment.startMs) / (segment.endMs - segment.startMs)) * 100))
  useEffect(() => {
    let raf = 0
    const frame = () => {
      const value = Math.max(0, Math.min(1, (Date.now() - segment.startMs) / (segment.endMs - segment.startMs)))
      if (barRef.current) barRef.current.style.transform = `scaleX(${value})`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [segment.startMs, segment.endMs])

  return <motion.article
    layout
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    className={`dashboard-card progress-card ${isOpen ? 'dashboard-card-expanded' : 'dashboard-card-collapsed'}`}
    onClick={() => { if (!isOpen) setIsOpen(true) }}
  >
    <div
      className="card-heading-trigger"
      onClick={e => { e.stopPropagation(); setIsOpen(v => !v) }}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(v => !v) } }}
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
          <div>
            <div className="current-session-label">CURRENT ACTIVITY <span className="session-badge" style={{ color: colors[segment.kind] }}><span style={{ background: colors[segment.kind] }} />{segment.kind.toUpperCase()}</span></div>
            <div className="current-session-title">{segment.name}</div>
            <div className="progress-head"><span>TIME PROGRESSED</span><strong>{percentage.toFixed(1)}%</strong></div>
            <div className="progress-track" role="progressbar" aria-label={`Scheduled progress through ${segment.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}>
              <div ref={barRef} className="progress-fill" style={{ transform: `scaleX(${percentage / 100})`, background: colors[segment.kind] }} />
            </div>
          </div>
          <div className="progress-stats">
            <div><span>ELAPSED</span><strong>{formatDuration(now - segment.startMs, true)}</strong></div>
            <div><span>REMAINING</span><strong>{formatDuration(segment.endMs - now, true)}</strong></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.article>
}

function UpNextCard({ now, colors }: { now: number; colors: Record<ActivityKind, string> }) {
  const [isOpen, setIsOpen] = useState(false)
  const upcoming = getUpcomingSegments(now, 3)

  return <motion.article
    layout
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    className={`dashboard-card upnext-card ${isOpen ? 'dashboard-card-expanded' : 'dashboard-card-collapsed'}`}
    onClick={() => { if (!isOpen) setIsOpen(true) }}
  >
    <div
      className="card-heading-trigger"
      onClick={e => { e.stopPropagation(); setIsOpen(v => !v) }}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(v => !v) } }}
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
          <div className="upnext-list">
            {upcoming.map((s, i) => <div className="upnext-item" key={`${s.startMs}-${s.id}`}>
              <div className="upnext-time"><span className="upnext-order">0{i + 1}</span><strong>{formatTime(s.startMs)}</strong></div>
              <div className="upnext-dot" style={{ background: colors[s.kind] }} />
              <div className="upnext-detail"><strong>{s.name}</strong><span>{formatDuration(s.endMs - s.startMs)} scheduled</span></div>
              <ArrowRight size={14} className="upnext-arrow" />
            </div>)}
          </div>
          <div className="upnext-foot">YOUR NEXT THREE SCHEDULED BLOCKS <span>↗</span></div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.article>
}

function OverviewCard({ now, segment }: { now: number; segment: Segment }) {
  const [isOpen, setIsOpen] = useState(false)
  const overview = getStudyOverview(now)

  return <motion.article
    layout
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    className={`dashboard-card today-card ${isOpen ? 'dashboard-card-expanded' : 'dashboard-card-collapsed'}`}
    onClick={() => { if (!isOpen) setIsOpen(true) }}
  >
    <div
      className="card-heading-trigger"
      onClick={e => { e.stopPropagation(); setIsOpen(v => !v) }}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(v => !v) } }}
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
            <div className="overview-total">12<span>h</span> 30<span>m</span><i> / DAY</i></div>
            <div className="overview-divider" />
            <div className="overview-stats">
              <div><span>ELAPSED TODAY</span><strong>{formatDuration(overview.elapsed)}</strong><div className="overview-minibar"><div style={{ width: `${overview.elapsed / SCHEDULED_STUDY_MS * 100}%` }} /></div></div>
              <div><span>REMAINING TODAY</span><strong>{formatDuration(Math.ceil(overview.remaining / 60000) * 60000)}</strong><div className="overview-minibar muted"><div style={{ width: `${overview.remaining / SCHEDULED_STUDY_MS * 100}%` }} /></div></div>
            </div>
          </div>
          <div className="current-study-indicator"><span>CURRENT STUDY SESSION</span><strong>{segment.kind === 'study' ? `0${segment.number} / 05` : '— / 05'}</strong></div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.article>
}

function Legend({ colors }: { colors: Record<ActivityKind, string> }) {
  return <div className="schedule-legend" aria-label="Schedule color legend">
    {([['study', 'STUDY'], ['break', 'BREAKS & MEALS'], ['sleep', 'SLEEP'], ['routine', 'ROUTINE']] as const).map(([kind, label]) => <div key={kind}><span style={{ background: colors[kind] }} />{label}</div>)}
  </div>
}

function SchedulePage({ now, onOverview, colors }: { now: number; onOverview: () => void; colors: Record<ActivityKind, string> }) {
  const active = getCurrentSegment(now)
  return <section className="secondary-page">
    <div className="secondary-top"><div><span className="eyebrow">YOUR DAILY ROUTINE</span><h1>The complete schedule<span className="mint-period">.</span></h1><p>Every minute has its place. This timetable repeats each day in your device's local timezone.</p></div><button className="subtle-action" onClick={onOverview}><Compass size={16} /> VIEW LIVE TIMELINE <ArrowRight size={15} /></button></div>
    <div className="schedule-summary"><div><span>STUDY</span><strong>12h 30m</strong></div><div><span>SLEEP</span><strong>7h 30m</strong></div><div><span>BREAKS & MEALS</span><strong>3h 30m</strong></div><div><span>MORNING ROUTINE</span><strong>30m</strong></div></div>
    <div className="schedule-table-head"><span>TIME</span><span>ACTIVITY</span><span>DURATION</span><span>STATUS</span></div>
    <div className="schedule-rows">{DAILY_SCHEDULE.map(item => {
      const start = new Date(now); start.setHours(item.start[0], item.start[1], 0, 0)
      const end = new Date(now); end.setHours(item.end[0], item.end[1], 0, 0)
      if (item.end[0] < item.start[0]) end.setDate(end.getDate() + 1)
      const current = active.id === item.id
      return <div className={`schedule-row ${current ? 'schedule-row-current' : ''}`} key={item.id}>
        <div className="schedule-row-time">{formatTime(start.getTime())} <span>—</span> {formatTime(end.getTime())}</div>
        <div className="schedule-row-activity"><span className="schedule-row-icon" style={{ color: colors[item.kind], background: `${colors[item.kind]}17` }}><ActivityIcon kind={item.kind} /></span><strong>{item.name}</strong></div>
        <div className="schedule-row-duration">{formatDuration(end.getTime() - start.getTime())}</div>
        <div className="schedule-row-status">{current && <span className="now-pill"><span /> IN PROGRESS</span>}</div>
      </div>
    })}</div>
    <div className="schedule-caveat">All figures are scheduled time, not recorded study completion. The overnight sleep block continues into the following morning.</div>
  </section>
}

const ALLOCATION = [
  { label: 'Study', kind: 'study' as const, minutes: 750 },
  { label: 'Sleep', kind: 'sleep' as const, minutes: 450 },
  { label: 'Breaks & meals', kind: 'break' as const, minutes: 210 },
  { label: 'Morning routine', kind: 'routine' as const, minutes: 30 },
]

function InsightsPage({ now, colors }: { now: number; colors: Record<ActivityKind, string> }) {
  const overview = getStudyOverview(now)
  const sessions = DAILY_SCHEDULE.filter(s => s.kind === 'study')
  return <section className="secondary-page">
    <div className="secondary-top"><div><span className="eyebrow">PLANNED TIME / NOT PERFORMANCE</span><h1>Time, accounted for<span className="mint-period">.</span></h1><p>A clear breakdown of your repeating 24-hour timetable. No guessed productivity or unrecorded completions.</p></div><div className="insights-label"><Sparkles size={16} /> SCHEDULE-BASED INSIGHTS</div></div>
    <div className="insights-grid">
      <article className="dashboard-card insight-allocation"><TinyHeading number="01 / 02" title="DAILY TIME ALLOCATION" icon={<Activity size={17} />} /><h2>24<span>h</span> <small>planned</small></h2><div className="allocation-bar">{ALLOCATION.map(a => <div key={a.kind} style={{ width: `${a.minutes / 1440 * 100}%`, background: colors[a.kind] }} title={`${a.label}: ${formatDuration(a.minutes * 60000)}`} />)}</div><div className="allocation-list">{ALLOCATION.map(a => <div key={a.kind}><span className="allocation-label"><i style={{ background: colors[a.kind] }} />{a.label}</span><strong>{formatDuration(a.minutes * 60000)}</strong><span className="allocation-percent">{(a.minutes / 1440 * 100).toFixed(1)}%</span></div>)}</div></article>
      <article className="dashboard-card insight-study"><TinyHeading number="02 / 02" title="STUDY SESSION DISTRIBUTION" icon={<BookOpenText size={17} />} /><h2>12<span>h</span> 30<span>m</span> <small>scheduled study</small></h2><div className="session-bars">{sessions.map(s => { const duration = (s.end[0] * 60 + s.end[1]) - (s.start[0] * 60 + s.start[1]); return <div className="session-bar-row" key={s.id}><div className="session-bar-label"><span>SESSION 0{s.number}</span><strong>{formatDuration(duration * 60000)}</strong></div><div className="session-bar-track"><div style={{ width: `${duration / 180 * 100}%` }} /></div></div> })}</div></article>
    </div>
    <div className="insight-footer"><Clock3 size={17} /><span>As of {formatClock(now)}, {formatDuration(overview.elapsed)} of today's scheduled study time has passed; {formatDuration(Math.ceil(overview.remaining / 60000) * 60000)} remains on the timetable (rounded up to the next minute).</span></div>
  </section>
}

export default function App() {
  const now = useLocalClock()
  const [tab, setTab] = useState<Tab>('overview')
  const [live, setLive] = useState(true)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('atelier_focus_theme') as ThemeId
    return (saved === 'theme-1' || saved === 'theme-2') ? saved : 'theme-1'
  })
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('atelier_focus_theme', theme)
  }, [theme])

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

  const active = getCurrentSegment(now)
  const remainingMs = Math.max(0, active.endMs - now)
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const currentTheme = THEMES[theme]
  const colors = getKindColors(theme)

  return <div className="app-shell" data-theme={theme}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className={`site-header ${headerVisible ? '' : 'header-hidden'}`}>
      <a href="#overview" className="brand" onClick={e => { e.preventDefault(); setTab('overview') }} aria-label="Atelier Focus home">
        <div className="brand-glyph"><span /><span /><span /><span /></div>
        <span className="brand-text">ATELIER <i>/</i> <em>FOCUS</em></span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">{(['overview', 'schedule', 'insights'] as const).map(name => <button type="button" key={name} className={tab === name ? 'nav-active' : ''} onClick={() => setTab(name)} aria-current={tab === name ? 'page' : undefined}>{name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
      <div className="header-right-group">
        <div className="header-date"><CalendarDays size={15} /><span>{shortDate(now)}</span><i /><span className="header-timezone">{localZone.replaceAll('_', ' ')}</span></div>
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
            <span className="theme-btn-swatch" style={{ background: currentTheme.colors.study }} />
            <ChevronDown size={12} className={`theme-btn-arrow ${themeMenuOpen ? 'open' : ''}`} />
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
                        <span style={{ background: t.colors.study }} title="Study" />
                        <span style={{ background: t.colors.break }} title="Break" />
                        <span style={{ background: t.colors.sleep }} title="Sleep" />
                      </div>
                      <div className="theme-item-text">
                        <strong>{t.name}</strong>
                        <span>{t.subtitle}</span>
                      </div>
                    </div>
                    {isActive && <Check size={14} className="theme-check-icon" />}
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
        {tab === 'overview' ? <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          <div className="top-context"><span><span className="top-context-line" /> YOUR DAY, IN REAL TIME</span><span>THE ART OF TIME WELL SPENT <span className="context-star">✳</span></span></div>
          <div className="hero">
            <div className="hero-left">
              <AnimatePresence mode="wait"><motion.h1 key={`${active.id}-${active.startMs}`} initial={{ opacity: .6, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .24 }}>{active.name}<span className="mint-period">.</span></motion.h1></AnimatePresence>
              <div className="hero-sub"><span className="hero-sub-icon" style={{ color: colors[active.kind] }}><ActivityIcon kind={active.kind} size={15} /></span><span>{formatRange(active.startMs, active.endMs)}</span><span className="hero-sub-separator" /><span>{formatDuration(active.endMs - active.startMs)} block</span></div>
            </div>
            <div className="hero-right">
              <strong className="hero-countdown">{formatDuration(remainingMs, true)}</strong>
              <span className="hero-countdown-caption">REMAINING IN CURRENT ACTIVITY</span>
            </div>
          </div>
          <TimelineInstrument live={live} onLiveChange={setLive} theme={theme} />
          <div className="between-panels"><Legend colors={colors} /><div className="between-message"><Check size={12} /> SYNCED TO YOUR LOCAL TIME</div></div>
          <div className="dashboard-grid"><ProgressCard segment={active} now={now} colors={colors} /><UpNextCard now={now} colors={colors} /><OverviewCard now={now} segment={active} /></div>
          <div className="footnote"><span>ATELIER / FOCUS <i>©</i> THE DISCIPLINE OF TIME</span><span>ALL TIME METRICS ARE SCHEDULED, NOT RECORDED PRODUCTIVITY</span></div>
        </motion.div> : tab === 'schedule' ? <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}><SchedulePage now={now} onOverview={() => setTab('overview')} colors={colors} /></motion.div> : <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}><InsightsPage now={now} colors={colors} /></motion.div>}
      </AnimatePresence>
    </main>
  </div>
}
