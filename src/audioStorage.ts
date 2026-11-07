export interface StoredAudioSettingsV1 {
  version: 1
  enabled: boolean
  volume: number // 0 to 100
}

export const AUDIO_STORAGE_KEY = 'atelier_focus_audio_v1'

export const DEFAULT_AUDIO_SETTINGS: StoredAudioSettingsV1 = Object.freeze({
  version: 1,
  enabled: false,
  volume: 40,
})

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage
    }
  } catch {
    // Storage access blocked or restricted
  }
  return null
}

export function loadAudioSettings(): StoredAudioSettingsV1 {
  try {
    const storage = getStorage()
    if (!storage) {
      return { ...DEFAULT_AUDIO_SETTINGS }
    }

    const raw = storage.getItem(AUDIO_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_AUDIO_SETTINGS }
    }

    const parsed = JSON.parse(raw) as Partial<StoredAudioSettingsV1>
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return { ...DEFAULT_AUDIO_SETTINGS }
    }

    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : false
    let volume = typeof parsed.volume === 'number' && !Number.isNaN(parsed.volume) ? parsed.volume : 40
    volume = Math.max(0, Math.min(100, Math.round(volume)))

    return {
      version: 1,
      enabled,
      volume,
    }
  } catch (err) {
    console.warn('Failed to load audio settings, using defaults:', err)
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
}

export function saveAudioSettings(settings: StoredAudioSettingsV1): { success: boolean; error?: string } {
  try {
    const storage = getStorage()
    if (!storage) {
      return { success: false, error: 'Local storage unavailable' }
    }

    const payload: StoredAudioSettingsV1 = {
      version: 1,
      enabled: Boolean(settings.enabled),
      volume: Math.max(0, Math.min(100, Math.round(settings.volume))),
    }

    storage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload))
    return { success: true }
  } catch (err) {
    console.warn('Failed to save audio settings:', err)
    return { success: false, error: String(err) }
  }
}
