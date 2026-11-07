import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Play,
  Square,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { audioEngine, type AudioState } from './audioEngine'
import type { StoredAudioSettingsV1 } from './audioStorage'
import type { ThemeId } from './schedule'

interface SoundSettingsProps {
  settings: StoredAudioSettingsV1
  onUpdateSettings: (updates: Partial<StoredAudioSettingsV1>) => void
  theme?: ThemeId
}

export function SoundSettings({
  settings,
  onUpdateSettings,
}: SoundSettingsProps) {
  const [audioState, setAudioState] = useState<AudioState>(() => audioEngine.getAudioState())
  const [isPlayingTest, setIsPlayingTest] = useState(false)

  useEffect(() => {
    return audioEngine.subscribe({
      onStateChange: nextState => {
        setAudioState(nextState)
      },
      onPlayingChange: tuneId => {
        setIsPlayingTest(tuneId === 'soft-chime')
      },
    })
  }, [])

  const handleToggleEnable = async () => {
    const nextEnabled = !settings.enabled
    if (nextEnabled) {
      // Resume or initialize AudioContext directly within the user interaction
      await audioEngine.unlockAudio()
    } else {
      audioEngine.stopAll()
    }
    onUpdateSettings({ enabled: nextEnabled })
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
    audioEngine.setMasterVolume(vol)
    onUpdateSettings({ volume: vol })
  }

  const handleTestSound = async () => {
    if (isPlayingTest) {
      audioEngine.stopAll()
    } else {
      await audioEngine.unlockAudio()
      await audioEngine.playTune('soft-chime', settings.volume)
    }
  }

  const handleUnlockAudio = async () => {
    await audioEngine.unlockAudio()
  }

  return (
    <div className="editor-card sound-settings-card" aria-label="Session Sound Settings">
      <div className="sound-settings-header">
        <div className="sound-header-left">
          <span className="sound-eyebrow">SESSION SOUNDS</span>
          <p className="sound-subtitle">A little sound to mark your next chapter.</p>
        </div>

        {/* Audio Engine Status Indicator */}
        <div className="sound-status-container">
          {audioState === 'ready' && (
            <span className="sound-status-badge status-ready" title="Web audio is active and ready">
              <span className="status-dot dot-green" />
              <span>AUDIO READY</span>
            </span>
          )}
          {audioState === 'suspended' && (
            <div className="sound-status-wrap">
              <span className="sound-status-badge status-warning" title="Browser requires user activation before audio can play">
                <span className="status-dot dot-amber" />
                <span>AUDIO PAUSED</span>
              </span>
              <button
                type="button"
                className="sound-unlock-btn"
                onClick={handleUnlockAudio}
                title="Click to unlock browser audio"
              >
                <Zap size={11} />
                <span>ENABLE SOUNDS</span>
              </button>
            </div>
          )}
          {audioState === 'uninitialized' && (
            <span className="sound-status-badge status-neutral" title="Audio will initialize on first user gesture">
              <span className="status-dot dot-neutral" />
              <span>READY ON INTERACTION</span>
            </span>
          )}
          {audioState === 'unsupported' && (
            <span className="sound-status-badge status-danger" title="Web Audio API not supported in this browser">
              <span className="status-dot dot-red" />
              <span>UNSUPPORTED</span>
            </span>
          )}
        </div>
      </div>

      {/* Blocked Audio Policy Banner */}
      {audioState === 'suspended' && settings.enabled && (
        <div className="sound-blocked-banner" role="alert">
          <AlertTriangle size={15} className="blocked-banner-icon" />
          <div className="blocked-banner-content">
            <span>
              Your browser paused audio. Click <strong>Enable Sounds</strong> to allow completion tunes.
            </span>
            <button
              type="button"
              className="banner-activate-btn"
              onClick={handleUnlockAudio}
            >
              ACTIVATE AUDIO
            </button>
          </div>
        </div>
      )}

      {/* Settings Grid / Controls */}
      <div className="sound-controls-grid">
        {/* Master Toggle */}
        <div className="sound-control-group master-toggle-group">
          <div className="control-label-wrap">
            <span className="sound-control-label">ENABLE COMPLETION SOUNDS</span>
            <span className="sound-control-desc">
              Play a selected notification tune when any scheduled block ends.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            aria-label="Enable Completion Sounds"
            className={`sound-switch ${settings.enabled ? 'switch-on' : 'switch-off'}`}
            onClick={handleToggleEnable}
          >
            <span className="switch-thumb" />
          </button>
        </div>

        {/* Volume Slider */}
        <div className="sound-control-group volume-group">
          <div className="control-label-wrap">
            <div className="volume-label-row">
              <span className="sound-control-label">VOLUME</span>
              <span className="volume-percentage">{settings.volume}%</span>
            </div>
          </div>

          <div className="volume-slider-wrap">
            <button
              type="button"
              className="volume-icon-btn"
              onClick={() => onUpdateSettings({ volume: settings.volume > 0 ? 0 : 40 })}
              aria-label={settings.volume === 0 ? 'Unmute' : 'Mute'}
              title={settings.volume === 0 ? 'Click to unmute' : 'Click to mute'}
            >
              {settings.volume === 0 ? (
                <VolumeX size={16} className="volume-icon muted" />
              ) : (
                <Volume2 size={16} className="volume-icon" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.volume}
              onChange={handleVolumeChange}
              className="volume-range-input"
              aria-label="Sound Volume"
            />
          </div>
        </div>

        {/* Test Sound Button */}
        <div className="sound-control-group test-sound-group">
          <div className="control-label-wrap">
            <span className="sound-control-label">PREVIEW SOUND</span>
            <span className="sound-control-desc">Tests Soft Chime at current volume.</span>
          </div>

          <button
            type="button"
            className={`sound-test-btn ${isPlayingTest ? 'test-btn-playing' : ''}`}
            onClick={handleTestSound}
            aria-label={isPlayingTest ? 'Stop preview' : 'Test sound preview'}
            title={isPlayingTest ? 'Stop preview' : 'Play Soft Chime preview'}
          >
            {isPlayingTest ? (
              <>
                <Square size={13} className="test-btn-icon" />
                <span>STOP</span>
              </>
            ) : (
              <>
                <Play size={13} className="test-btn-icon" />
                <span>TEST SOUND</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
