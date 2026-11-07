import { useCallback, useEffect, useRef, useState } from 'react'
import { Crosshair, Pause, Play, RotateCcw } from 'lucide-react'
import { formatClock, formatDuration, formatRange, getKindColors, makeSegments, type Segment, type ThemeId } from './schedule'

const ZOOM_SPANS = [24 * 3600000, 3 * 3600000, 3600000, 10 * 60000, 60000]
const TICK_FAMILIES = [
  { major: 3600000, minor: 900000 },
  { major: 1800000, minor: 300000 },
  { major: 600000, minor: 60000 },
  { major: 60000, minor: 10000 },
  { major: 10000, minor: 1000 },
]
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function spanForZoom(z: number) {
  const low = Math.floor(clamp(z, 0, 4))
  const high = Math.min(low + 1, 4)
  const mix = z - low
  return Math.exp(Math.log(ZOOM_SPANS[low]) * (1 - mix) + Math.log(ZOOM_SPANS[high]) * mix)
}

function tickLabel(ms: number, level: number) {
  const d = new Date(ms)
  const hour = d.getHours()
  const hr12 = hour % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  if (level === 0) return `${hr12} ${hour < 12 ? 'AM' : 'PM'}`
  if (level === 4) return `${min}:${sec}`
  return `${hr12}:${min}`
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function drawRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(radius, h / 2, w / 2))
}

function paintTimeline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerMs: number,
  zoom: number,
  realNow: number,
  segments: Segment[],
  theme: ThemeId = 'theme-1',
) {
  ctx.clearRect(0, 0, width, height)
  const scale = width / spanForZoom(zoom)
  const leftMs = centerMs - width / (2 * scale)
  const rightMs = centerMs + width / (2 * scale)
  const xAt = (ms: number) => width / 2 + (ms - centerMs) * scale

  const isTheme2 = theme === 'theme-2'
  const colors = getKindColors(theme)

  // Single shared coordinate model for the entire instrument.
  ctx.fillStyle = isTheme2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.018)'
  ctx.fillRect(0, 166, width, 1)

  const baseLevel = Math.floor(zoom)
  const families = [baseLevel, Math.min(4, baseLevel + 1)]
  for (const level of families) {
    if (level !== baseLevel && zoom === baseLevel) continue
    const weight = level === baseLevel ? 1 - (zoom - baseLevel) : zoom - baseLevel
    if (weight <= 0.015) continue
    const { major, minor } = TICK_FAMILIES[level]
    const minorPx = minor * scale
    if (minorPx < 3.1) continue
    const majorPx = major * scale
    const majorRatio = major / minor
    const labelStride = Math.max(1, Math.ceil((level === 0 ? 42 : 58) / majorPx))
    const middle = new Date(centerMs)
    ctx.font = '500 10px "DM Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    for (let dayOffset = -2; dayOffset <= 2; dayOffset++) {
      const dayStart = new Date(middle.getFullYear(), middle.getMonth(), middle.getDate() + dayOffset).getTime()
      const dayEnd = new Date(middle.getFullYear(), middle.getMonth(), middle.getDate() + dayOffset + 1).getTime()
      if (dayEnd < leftMs || dayStart > rightMs) continue
      const firstIndex = Math.max(0, Math.ceil((leftMs - dayStart) / minor))
      const lastIndex = Math.min(Math.ceil((dayEnd - dayStart) / minor), Math.floor((rightMs - dayStart) / minor) + 1)
      for (let i = firstIndex; i <= lastIndex; i++) {
        const t = dayStart + i * minor
        if (t >= dayEnd || t < leftMs - minor || t > rightMs + minor) continue
        const x = xAt(t)
        const isMajor = i % majorRatio === 0
        const length = isMajor ? 42 : 14
        ctx.beginPath()
        ctx.moveTo(Math.round(x) + .5, 166)
        ctx.lineTo(Math.round(x) + .5, 166 - length)
        ctx.lineWidth = isMajor ? 1.2 : 1
        ctx.strokeStyle = isMajor
          ? (isTheme2 ? `rgba(147,197,253,${0.62 * weight})` : `rgba(194,221,207,${0.56 * weight})`)
          : (isTheme2 ? `rgba(100,116,139,${0.35 * weight})` : `rgba(153,173,163,${0.25 * weight})`)
        ctx.stroke()
        if (isMajor) {
          ctx.fillStyle = isTheme2 ? `rgba(59,130,246,${0.12 * weight})` : `rgba(139,160,150,${0.09 * weight})`
          ctx.fillRect(x, 169, 1, 123)
          if ((i / majorRatio) % labelStride === 0) {
            ctx.fillStyle = isTheme2 ? `rgba(219,234,254,${0.85 * weight})` : `rgba(203,221,211,${0.78 * weight})`
            ctx.fillText(tickLabel(t, level), x, 108)
          }
        }
      }
    }
  }

  const barY = 194
  const barH = 86
  for (const segment of segments) {
    if (segment.endMs < leftMs || segment.startMs > rightMs) continue
    const rawX = xAt(segment.startMs)
    const rawEnd = xAt(segment.endMs)
    const x = Math.max(-1, rawX + 1.5)
    const end = Math.min(width + 1, rawEnd - 1.5)
    const w = end - x
    if (w <= 0) continue
    const active = realNow >= segment.startMs && realNow < segment.endMs
    const color = colors[segment.kind]
    const opacity = active ? 0.22 : 0.12
    ctx.save()
    drawRounded(ctx, x, barY, w, barH, 9)
    ctx.fillStyle = hexToRgba(color, opacity)
    ctx.fill()
    drawRounded(ctx, x, barY, w, barH, 9)
    ctx.strokeStyle = active ? `${color}88` : `${color}30`
    ctx.lineWidth = active ? 1.2 : 1
    ctx.stroke()
    ctx.beginPath()
    ctx.rect(x, barY, w, barH)
    ctx.clip()
    ctx.fillStyle = color
    ctx.globalAlpha = active ? 0.94 : 0.62
    ctx.fillRect(x + 1, barY + 1, Math.max(0, Math.min(w - 2, 3)), barH - 2)
    ctx.globalAlpha = 1
    if (w > 50) {
      const textX = Math.max(x + 15, Math.min(rawX + 15, width - 180))
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = '600 12px "Manrope", sans-serif'
      ctx.fillStyle = active
        ? (isTheme2 ? '#ffffff' : '#eafff1')
        : (isTheme2 ? '#e2e8f0' : '#bfd0c5')
      ctx.fillText(segment.name, textX, barY + 32, Math.max(0, end - textX - 10))
      if (w > 97) {
        ctx.font = '400 10px "DM Mono", monospace'
        ctx.fillStyle = active
          ? (isTheme2 ? '#93c5fd' : '#b1d5bf')
          : (isTheme2 ? '#94a3b8' : '#81978a')
        ctx.fillText(formatRange(segment.startMs, segment.endMs), textX, barY + 53, Math.max(0, end - textX - 10))
      }
    }
    ctx.restore()
  }
}

interface Props {
  live: boolean
  onLiveChange: (live: boolean) => void
  theme?: ThemeId
}

export default function TimelineInstrument({ live, onLiveChange, theme = 'theme-1' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const targetZoomRef = useRef(1)
  const zoomRef = useRef(1)
  const liveRef = useRef(true)
  const frozenRef = useRef(Date.now())
  const viewRef = useRef(Date.now())
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const geometryRef = useRef({ centerMs: Date.now(), scale: 1 })
  const segmentCacheRef = useRef({ key: '', value: [] as Segment[] })
  const returnRef = useRef<{ from: number; start: number } | null>(null)
  const pointerRef = useRef(new Map<number, { x: number; y: number }>())
  const panRef = useRef<{ x: number; ms: number; moved: boolean } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const reducedMotionRef = useRef(false)
  const [zoomDisplay, setZoomDisplay] = useState(1)
  const [tooltip, setTooltip] = useState<{ segment: Segment; x: number; y: number; pinned: boolean } | null>(null)
  const themeRef = useRef(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  const setTargetZoom = useCallback((value: number) => {
    targetZoomRef.current = clamp(value, 0, 4)
    setZoomDisplay(targetZoomRef.current)
  }, [])

  const pause = useCallback(() => {
    frozenRef.current = viewRef.current
    returnRef.current = null
    liveRef.current = false
    onLiveChange(false)
  }, [onLiveChange])

  const returnToNow = useCallback(() => {
    setTooltip(null)
    if (liveRef.current && !returnRef.current) return
    returnRef.current = { from: viewRef.current, start: performance.now() }
  }, [])

  const toggleLive = useCallback(() => {
    if (liveRef.current || returnRef.current) pause()
    else returnToNow()
  }, [pause, returnToNow])

  useEffect(() => {
    liveRef.current = live
  }, [live])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { reducedMotionRef.current = media.matches }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      sizeRef.current = { width, height, dpr }
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    })
    observer.observe(canvas)
    let previousFrame = performance.now()
    let lastLabel = 0
    const render = (frameTime: number) => {
      const dt = Math.min(0.1, (frameTime - previousFrame) / 1000)
      previousFrame = frameTime
      const smoothing = reducedMotionRef.current ? 1 : 1 - Math.exp(-14 * dt)
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * smoothing
      if (Math.abs(targetZoomRef.current - zoomRef.current) < 0.0001) zoomRef.current = targetZoomRef.current
      const now = Date.now()
      let centerMs: number
      if (returnRef.current) {
        const t = clamp((frameTime - returnRef.current.start) / (reducedMotionRef.current ? 1 : 680), 0, 1)
        const eased = t * t * (3 - 2 * t)
        centerMs = returnRef.current.from + (now - returnRef.current.from) * eased
        if (t === 1) {
          returnRef.current = null
          liveRef.current = true
          onLiveChange(true)
        }
      } else {
        centerMs = liveRef.current ? now : frozenRef.current
      }
      viewRef.current = centerMs
      const { width, height, dpr } = sizeRef.current
      if (width > 0 && height > 0) {
        const scale = width / spanForZoom(zoomRef.current)
        geometryRef.current = { centerMs, scale }
        const date = new Date(centerMs)
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        if (segmentCacheRef.current.key !== key) {
          segmentCacheRef.current = { key, value: makeSegments(centerMs, 2, 3) }
        }
        const ctx = canvas.getContext('2d', { alpha: true })
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          paintTimeline(ctx, width, height, centerMs, zoomRef.current, now, segmentCacheRef.current.value, themeRef.current)
        }
      }
      if (thumbRef.current) thumbRef.current.style.top = `${(1 - zoomRef.current / 4) * 100}%`
      if (frameTime - lastLabel > 80) {
        if (timeRef.current) timeRef.current.textContent = formatClock(centerMs)
        lastLabel = frameTime
      }
      frameRef.current = requestAnimationFrame(render)
    }
    frameRef.current = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
    }
  }, [onLiveChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault()
        setTargetZoom(targetZoomRef.current - e.deltaY * 0.007)
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) + 4 || e.shiftKey) {
        e.preventDefault()
        pause()
        frozenRef.current -= (e.deltaX || e.deltaY) / geometryRef.current.scale
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [pause, setTargetZoom])

  function findSegment(x: number, y: number) {
    if (y < 194 || y > 280) return null
    const { centerMs, scale } = geometryRef.current
    const ms = centerMs + (x - sizeRef.current.width / 2) / scale
    return segmentCacheRef.current.value.find(s => s.startMs <= ms && ms < s.endMs) ?? null
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    const p = canvasPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerRef.current.set(event.pointerId, p)
    setTooltip(null)
    if (pointerRef.current.size === 2) {
      const [a, b] = Array.from(pointerRef.current.values())
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: targetZoomRef.current }
      panRef.current = null
    } else {
      panRef.current = { x: p.x, ms: viewRef.current, moved: false }
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = canvasPoint(event)
    if (pointerRef.current.has(event.pointerId)) {
      pointerRef.current.set(event.pointerId, p)
      if (pointerRef.current.size >= 2 && pinchRef.current) {
        const [a, b] = Array.from(pointerRef.current.values())
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        setTargetZoom(pinchRef.current.zoom + Math.log2(Math.max(8, distance) / Math.max(8, pinchRef.current.distance)) * 1.4)
        return
      }
      if (panRef.current && Math.abs(p.x - panRef.current.x) > 3) {
        if (!panRef.current.moved) pause()
        panRef.current.moved = true
        frozenRef.current = panRef.current.ms - (p.x - panRef.current.x) / geometryRef.current.scale
      }
    } else if (event.pointerType === 'mouse') {
      const segment = findSegment(p.x, p.y)
      setTooltip(old => {
        if (old?.pinned) return old
        if (!segment) return null
        if (old?.segment.startMs === segment.startMs && Math.abs(old.x - p.x) < 10) return old
        return { segment, x: p.x, y: p.y, pinned: false }
      })
    }
  }

  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = canvasPoint(event)
    const dragged = panRef.current?.moved
    pointerRef.current.delete(event.pointerId)
    if (pointerRef.current.size < 2) pinchRef.current = null
    if (pointerRef.current.size === 0) {
      panRef.current = null
      if (!dragged) {
        const segment = findSegment(p.x, p.y)
        if (segment) setTooltip({ segment, x: p.x, y: p.y, pinned: true })
      }
    }
  }

  function sliderFromPointer(y: number) {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    setTargetZoom(4 - ((y - rect.top) / rect.height) * 4)
  }

  function keyDown(event: React.KeyboardEvent) {
    if (event.key === '+' || event.key === '=' || event.key === 'ArrowUp') {
      event.preventDefault(); setTargetZoom(targetZoomRef.current + 0.25)
    } else if (event.key === '-' || event.key === '_' || event.key === 'ArrowDown') {
      event.preventDefault(); setTargetZoom(targetZoomRef.current - 0.25)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      pause()
      frozenRef.current += (event.key === 'ArrowRight' ? 1 : -1) * spanForZoom(zoomRef.current) * 0.08
    } else if (event.key === 'Home') {
      event.preventDefault(); returnToNow()
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault(); setTargetZoom(targetZoomRef.current + (event.key === 'PageUp' ? 1 : -1))
    }
  }

  return (
    <section className="instrument-panel" aria-label="Interactive real-time schedule ruler">
      <div className="instrument-topline">
        <div className="instrument-kicker"><span className="instrument-kicker-dot" /> PRECISION TIME RULER <span className="instrument-kicker-slash">/</span> 24H CYCLE</div>
      </div>
      <div className="instrument-body">
        <div className="ruler-stage">
          <canvas
            ref={canvasRef}
            className="ruler-canvas"
            aria-label="Moving time ruler and color-coded daily activity blocks. Drag horizontally to inspect time, use plus or minus to zoom, and Home to return to now."
            tabIndex={0}
            onKeyDown={keyDown}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onPointerLeave={() => setTooltip(old => old?.pinned ? old : null)}
          />
          <div className="center-anchor" aria-hidden="true">
            <div className="anchor-time"><span className="anchor-dot" /><span ref={timeRef}>{formatClock(Date.now())}</span><span className="anchor-caption">{live ? 'NOW' : 'VIEW'}</span></div>
            <div className="anchor-line"><div className="anchor-line-core" /></div>
          </div>
          {tooltip && (
            <div className="segment-tooltip" style={{ left: `clamp(110px, ${tooltip.x}px, calc(100% - 110px))`, top: 181 }} role="status">
              <div className="tooltip-title"><span style={{ background: getKindColors(theme)[tooltip.segment.kind] }} />{tooltip.segment.name}{tooltip.pinned && <button onClick={() => setTooltip(null)} aria-label="Close activity details">×</button>}</div>
              <div className="tooltip-time">{formatRange(tooltip.segment.startMs, tooltip.segment.endMs)}</div>
              <div className="tooltip-duration">{formatDuration(tooltip.segment.endMs - tooltip.segment.startMs)} scheduled</div>
            </div>
          )}
        </div>
        <aside className="zoom-control" aria-label="Timeline zoom controls">
          <div className="zoom-rail-wrap">
            <div ref={railRef} className="zoom-rail" role="slider" tabIndex={0} aria-label="Timeline zoom level" aria-valuemin={1} aria-valuemax={5} aria-valuenow={Math.round(zoomDisplay) + 1} aria-valuetext={`${(zoomDisplay + 1).toFixed(1)} times`} onKeyDown={keyDown} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); sliderFromPointer(e.clientY) }} onPointerMove={e => { if (e.buttons) sliderFromPointer(e.clientY) }}>
              <div className="zoom-rail-line" />
              {[4, 3, 2, 1, 0].map(z => <button key={z} type="button" tabIndex={-1} className="zoom-preset" style={{ top: `${(1 - z / 4) * 100}%` }} aria-label={`Set zoom to ${z + 1} times`} onClick={e => { e.stopPropagation(); setTargetZoom(z) }}><span className="zoom-preset-mark" /></button>)}
              <div ref={thumbRef} className="zoom-thumb" style={{ top: '75%' }} />
            </div>
            <div className="zoom-level-labels">{[5, 4, 3, 2, 1].map(z => <button type="button" key={z} onClick={() => setTargetZoom(z - 1)} className={Math.abs(zoomDisplay - (z - 1)) < .24 ? 'active' : ''} aria-label={`Zoom ${z} times`}>{z}×</button>)}</div>
          </div>
        </aside>
      </div>
      <div className="instrument-bottomline">
        <div className="instrument-actions">
          <button type="button" className={`control-button ${live ? 'control-button-active' : ''}`} onClick={toggleLive} aria-pressed={live}>{live ? <Pause size={14} /> : <Play size={14} />}{live ? 'PAUSE LIVE' : 'RESUME LIVE'}</button>
          <button type="button" className="control-button" onClick={returnToNow}><Crosshair size={14} /> RETURN TO NOW</button>
        </div>
        <div className="scale-readout"><RotateCcw size={12} /> <span>{zoomDisplay < .5 ? 'FULL DAY' : zoomDisplay < 1.5 ? '3 HOURS' : zoomDisplay < 2.5 ? '1 HOUR' : zoomDisplay < 3.5 ? '10 MINUTES' : '1 MINUTE'}</span> <i /> REAL-TIME SCALE</div>
      </div>
    </section>
  )
}
