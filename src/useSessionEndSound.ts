import { useEffect, useRef } from 'react'
import { audioEngine } from './audioEngine'
import { makeSegments, type ActivityDefinition } from './schedule'

export interface SessionBoundaryDetectorOptions {
  schedule: ActivityDefinition[]
  enabled: boolean
  volume: number // 0 to 100
  onSessionComplete?: (activity: ActivityDefinition, endMs: number) => void
  nowProvider?: () => number
}

const GRACE_PERIOD_MS = 5000 // 5-second grace period for timer delays / sleep wakeups

export class SessionBoundaryDetector {
  private handledEvents = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private backupInterval: ReturnType<typeof setInterval> | null = null
  private onVisibilityChangeHandler: (() => void) | null = null
  public options: SessionBoundaryDetectorOptions

  constructor(options: SessionBoundaryDetectorOptions) {
    this.options = options
    this.markPastSegmentsHandled(this.getNow())
    this.checkBoundariesAndSchedule()
    this.setupListeners()
  }

  public getNow(): number {
    return this.options.nowProvider ? this.options.nowProvider() : Date.now()
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private markPastSegmentsHandled(referenceTime: number) {
    if (!this.options.schedule || this.options.schedule.length === 0) return
    const segments = makeSegments(this.options.schedule, referenceTime, 1, 1)
    for (const seg of segments) {
      if (seg.endMs <= referenceTime) {
        this.handledEvents.add(`${seg.id}:${seg.endMs}`)
      }
    }
  }

  public updateOptions(newOptions: Partial<SessionBoundaryDetectorOptions>): void {
    const isScheduleChanged =
      newOptions.schedule !== undefined && newOptions.schedule !== this.options.schedule

    this.options = { ...this.options, ...newOptions }

    if (isScheduleChanged) {
      this.clearTimer()
      this.markPastSegmentsHandled(this.getNow())
      this.checkBoundariesAndSchedule()
    }
  }

  public checkBoundariesAndSchedule(): void {
    this.clearTimer()

    const { schedule, enabled, volume, onSessionComplete } = this.options
    if (!schedule || schedule.length === 0) return

    const now = this.getNow()
    const segments = makeSegments(schedule, now, 1, 1)

    // 1. Check if any segment completed
    for (const seg of segments) {
      if (now >= seg.endMs) {
        const eventKey = `${seg.id}:${seg.endMs}`
        if (!this.handledEvents.has(eventKey)) {
          this.handledEvents.add(eventKey)
          const diff = now - seg.endMs

          // Grace period check: allow within 5s
          if (diff >= 0 && diff <= GRACE_PERIOD_MS) {
            if (enabled && volume > 0 && seg.endTuneId && seg.endTuneId !== 'none') {
              audioEngine.playTune(seg.endTuneId, volume).catch(() => {})
            }
            onSessionComplete?.(seg, seg.endMs)
          }
          // If diff > 5000: skipped silently without queuing bursts
        }
      }
    }

    // 2. Prune old handled keys to prevent unbounded memory growth
    if (this.handledEvents.size > 200) {
      const cutoff = now - 24 * 60 * 60 * 1000
      const kept = new Set<string>()
      for (const key of this.handledEvents) {
        const parts = key.split(':')
        const endMs = Number(parts[parts.length - 1])
        if (!isNaN(endMs) && endMs > cutoff) {
          kept.add(key)
        }
      }
      this.handledEvents = kept
    }

    // 3. Find next upcoming boundary
    const lookaheadSegments = makeSegments(schedule, now, 0, 2)
    let nextEndMs = Infinity

    for (const seg of lookaheadSegments) {
      if (seg.endMs > now) {
        const eventKey = `${seg.id}:${seg.endMs}`
        if (!this.handledEvents.has(eventKey)) {
          if (seg.endMs < nextEndMs) {
            nextEndMs = seg.endMs
          }
        }
      }
    }

    if (Number.isFinite(nextEndMs)) {
      const delay = Math.max(0, nextEndMs - now)
      const safeDelay = Math.min(delay, 60 * 60 * 1000)
      this.timer = setTimeout(() => {
        this.checkBoundariesAndSchedule()
      }, safeDelay)
    }
  }

  private setupListeners() {
    this.onVisibilityChangeHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.checkBoundariesAndSchedule()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChangeHandler)
    }

    this.backupInterval = setInterval(() => {
      this.checkBoundariesAndSchedule()
    }, 15000)
  }

  public destroy(): void {
    this.clearTimer()
    if (this.backupInterval !== null) {
      clearInterval(this.backupInterval)
      this.backupInterval = null
    }
    if (typeof document !== 'undefined' && this.onVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeHandler)
      this.onVisibilityChangeHandler = null
    }
  }
}

export type UseSessionEndSoundOptions = SessionBoundaryDetectorOptions

export function useSessionEndSound(options: UseSessionEndSoundOptions): void {
  const detectorRef = useRef<SessionBoundaryDetector | null>(null)

  useEffect(() => {
    if (!detectorRef.current) {
      detectorRef.current = new SessionBoundaryDetector(options)
    } else {
      detectorRef.current.updateOptions(options)
    }
  }, [options.schedule, options.enabled, options.volume, options.onSessionComplete, options.nowProvider])

  useEffect(() => {
    return () => {
      detectorRef.current?.destroy()
      detectorRef.current = null
    }
  }, [])
}
