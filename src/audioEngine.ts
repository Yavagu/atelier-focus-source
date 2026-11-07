import {
  TUNE_SYNTHESIS_PATTERNS,
  type TuneId,
} from './sessionTunes'

export type AudioState =
  | 'ready'
  | 'suspended'
  | 'interrupted'
  | 'uninitialized'
  | 'unsupported'

export interface AudioEngineListener {
  onStateChange?: (state: AudioState) => void
  onPlayingChange?: (tuneId: TuneId | null) => void
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private activeTones: Array<{ osc: OscillatorNode; gain: GainNode }> = []
  private finishTimer: ReturnType<typeof setTimeout> | null = null
  private currentlyPlaying: TuneId | null = null
  private listeners = new Set<AudioEngineListener>()

  constructor() {}

  public getAudioState(): AudioState {
    if (typeof window === 'undefined') return 'unsupported'
    const AudioContextClass = this.getAudioContextClass()
    if (!AudioContextClass) return 'unsupported'
    if (!this.ctx) return 'uninitialized'
    return this.mapContextState(this.ctx.state)
  }

  public getCurrentlyPlaying(): TuneId | null {
    return this.currentlyPlaying
  }

  public subscribe(listener: AudioEngineListener): () => void {
    this.listeners.add(listener)
    listener.onStateChange?.(this.getAudioState())
    listener.onPlayingChange?.(this.currentlyPlaying)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyStateChange() {
    const state = this.getAudioState()
    for (const l of this.listeners) {
      l.onStateChange?.(state)
    }
  }

  private notifyPlayingChange(tuneId: TuneId | null) {
    this.currentlyPlaying = tuneId
    for (const l of this.listeners) {
      l.onPlayingChange?.(tuneId)
    }
  }

  private getAudioContextClass(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null
    return (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
      null
    )
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx

    const AudioContextClass = this.getAudioContextClass()
    if (!AudioContextClass) {
      this.notifyStateChange()
      return null
    }

    try {
      this.ctx = new AudioContextClass()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)

      this.ctx.onstatechange = () => {
        this.notifyStateChange()
      }

      this.notifyStateChange()
      return this.ctx
    } catch (err) {
      console.warn('Failed to create AudioContext:', err)
      this.notifyStateChange()
      return null
    }
  }

  private mapContextState(state: AudioContextState): AudioState {
    switch (state) {
      case 'running':
        return 'ready'
      case 'suspended':
        return 'suspended'
      case 'closed':
        return 'interrupted'
      default:
        return 'uninitialized'
    }
  }

  public async unlockAudio(): Promise<boolean> {
    const ctx = this.ensureContext()
    if (!ctx) return false

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (err) {
        console.warn('AudioContext resume failed:', err)
      }
    }

    this.notifyStateChange()
    return ctx.state === 'running'
  }

  public setMasterVolume(volume0to100: number): void {
    const normalized = Math.max(0, Math.min(1, volume0to100 / 100))
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(normalized, this.ctx.currentTime)
      } catch {
        this.masterGain.gain.value = normalized
      }
    }
  }

  public stopAll(): void {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer)
      this.finishTimer = null
    }

    if (this.ctx && this.activeTones.length > 0) {
      const now = this.ctx.currentTime
      for (const { osc, gain } of this.activeTones) {
        try {
          gain.gain.cancelScheduledValues(now)
          gain.gain.setValueAtTime(gain.gain.value, now)
          gain.gain.linearRampToValueAtTime(0.0001, now + 0.02)
          setTimeout(() => {
            try {
              osc.stop()
              osc.disconnect()
              gain.disconnect()
            } catch {
              // Ignore node cleanup errors
            }
          }, 35)
        } catch {
          // Ignore cancellation errors
        }
      }
    }

    this.activeTones = []
    if (this.currentlyPlaying !== null) {
      this.notifyPlayingChange(null)
    }
  }

  public async playTune(tuneId: TuneId, volume0to100 = 40): Promise<boolean> {
    if (tuneId === 'none') {
      this.stopAll()
      return true
    }

    const steps = TUNE_SYNTHESIS_PATTERNS[tuneId]
    if (!steps || steps.length === 0) {
      this.stopAll()
      return true
    }

    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return false

    // Try to resume if suspended
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (err) {
        console.warn('AudioContext resume failed in playTune:', err)
      }
    }

    if (ctx.state !== 'running') {
      this.notifyStateChange()
      return false
    }

    // Stop any existing playback
    this.stopAll()

    this.setMasterVolume(volume0to100)

    const startTime = ctx.currentTime + 0.02
    let maxEndTime = startTime

    const newTones: Array<{ osc: OscillatorNode; gain: GainNode }> = []

    for (const step of steps) {
      const noteStart = startTime + step.startTime
      const attack = step.attack ?? 0.015
      const duration = step.duration
      const noteEnd = noteStart + duration
      if (noteEnd > maxEndTime) {
        maxEndTime = noteEnd
      }

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = step.type || 'sine'
      osc.frequency.setValueAtTime(step.freq, noteStart)

      // Initial gain is 0
      gain.gain.setValueAtTime(0, noteStart)
      // Smooth attack
      gain.gain.linearRampToValueAtTime(step.gain, noteStart + attack)
      // Smooth exponential decay towards 0.0001
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(noteStart)
      osc.stop(noteEnd + 0.05)

      newTones.push({ osc, gain })
    }

    this.activeTones = newTones
    this.notifyPlayingChange(tuneId)

    const totalDurationMs = Math.ceil((maxEndTime - ctx.currentTime) * 1000) + 60
    this.finishTimer = setTimeout(() => {
      this.stopAll()
    }, totalDurationMs)

    return true
  }

  // Testing & mock hook
  public _injectContext(ctx: AudioContext | null) {
    this.stopAll()
    this.ctx = ctx
    if (ctx) {
      this.masterGain = ctx.createGain()
      this.masterGain.connect(ctx.destination)
    } else {
      this.masterGain = null
    }
    this.notifyStateChange()
  }
}

export const audioEngine = new AudioEngine()
