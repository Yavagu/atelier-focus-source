import { beforeEach, describe, expect, it } from 'vitest'
import { calculatePopoverCoords } from '../ActivityIcon'

const mockWindow = {
  innerWidth: 1200,
  innerHeight: 800,
}

Object.defineProperty(globalThis, 'window', {
  value: mockWindow,
  writable: true,
})

describe('IconPicker Popover Positioning', () => {
  beforeEach(() => {
    mockWindow.innerWidth = 1200
    mockWindow.innerHeight = 800
  })

  it('1. Places popover immediately to the right and vertically aligned on desktop', () => {
    mockWindow.innerWidth = 1200
    mockWindow.innerHeight = 800

    const mockTrigger = {
      getBoundingClientRect: () => ({
        top: 200,
        bottom: 238,
        left: 100,
        right: 138,
        width: 38,
        height: 38,
      }),
    } as unknown as HTMLElement

    const mockPopover = {
      offsetWidth: 320,
      offsetHeight: 340,
    } as unknown as HTMLElement

    const coords = calculatePopoverCoords(mockTrigger, mockPopover)

    // Gap is 10px immediately to the right
    expect(coords.left).toBe(138 + 10)
    // Vertically aligned with button top
    expect(coords.top).toBe(200)
    expect(coords.placement).toBe('right')
  })

  it('2. Automatically adjusts top position when bottom of viewport would overflow (e.g. last activity row)', () => {
    mockWindow.innerWidth = 1200
    mockWindow.innerHeight = 600

    const mockTrigger = {
      getBoundingClientRect: () => ({
        top: 500, // Near bottom: 500 + 340 = 840 > 600
        bottom: 538,
        left: 100,
        right: 138,
        width: 38,
        height: 38,
      }),
    } as unknown as HTMLElement

    const mockPopover = {
      offsetWidth: 320,
      offsetHeight: 340,
    } as unknown as HTMLElement

    const coords = calculatePopoverCoords(mockTrigger, mockPopover)

    // Still to the right of the button
    expect(coords.left).toBe(148)
    // Shifted upward so it fits within viewportHeight - 12 (600 - 340 - 12 = 248)
    expect(coords.top).toBe(600 - 340 - 12)
    expect(coords.placement).toBe('right')
  })

  it('3. Appears below the button on narrow screens / mobile (< 640px)', () => {
    mockWindow.innerWidth = 390
    mockWindow.innerHeight = 844

    const mockTrigger = {
      getBoundingClientRect: () => ({
        top: 150,
        bottom: 188,
        left: 24,
        right: 62,
        width: 38,
        height: 38,
      }),
    } as unknown as HTMLElement

    const mockPopover = {
      offsetWidth: 320,
      offsetHeight: 340,
    } as unknown as HTMLElement

    const coords = calculatePopoverCoords(mockTrigger, mockPopover)

    // Positioned below the button: rect.bottom + 10 = 188 + 10 = 198
    expect(coords.top).toBe(198)
    expect(coords.placement).toBe('bottom')
    // Stays within viewport margins
    expect(coords.left).toBeGreaterThanOrEqual(12)
    expect(coords.left + 320).toBeLessThanOrEqual(390 - 12)
  })

  it('4. Flips above the button on mobile if bottom would overflow', () => {
    mockWindow.innerWidth = 390
    mockWindow.innerHeight = 600

    const mockTrigger = {
      getBoundingClientRect: () => ({
        top: 450,
        bottom: 488,
        left: 24,
        right: 62,
        width: 38,
        height: 38,
      }),
    } as unknown as HTMLElement

    const mockPopover = {
      offsetWidth: 320,
      offsetHeight: 340,
    } as unknown as HTMLElement

    const coords = calculatePopoverCoords(mockTrigger, mockPopover)

    expect(coords.placement).toBe('top')
    expect(coords.top).toBeLessThan(450)
    expect(coords.top).toBeGreaterThanOrEqual(12)
  })
})
