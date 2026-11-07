import { describe, expect, it } from 'vitest'
import type { ActivityDefinition, Preset } from '../schedule'
import { validatePresetName, validateSchedule } from '../validation'

describe('Validation Engine', () => {
  it('1. Empty timetable rejected', () => {
    const res = validateSchedule([])
    expect(res.isValid).toBe(false)
    expect(res.generalErrors.length).toBeGreaterThan(0)
    expect(res.generalErrors[0]).toContain('At least one activity is required')
  })

  it('2. Empty activity name rejected', () => {
    const blocks: ActivityDefinition[] = [
      { id: 'b1', name: '   ', start: [9, 0], end: [10, 0], kind: 'study', icon: 'BookOpenText' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(false)
    expect(res.blockErrors['b1']).toBeDefined()
    expect(res.blockErrors['b1'][0]).toContain('name is required')
  })

  it('3. Invalid time values rejected', () => {
    const blocks: any[] = [
      { id: 'b1', name: 'Work', start: [25, 0], end: [10, 70], kind: 'study', icon: 'BookOpenText' },
    ]
    const res = validateSchedule(blocks as ActivityDefinition[])
    expect(res.isValid).toBe(false)
    expect(res.blockErrors['b1']).toBeDefined()
  })

  it('4. Same start and end rejected (zero duration)', () => {
    const blocks: ActivityDefinition[] = [
      { id: 'b1', name: 'Sprint', start: [10, 0], end: [10, 0], kind: 'study', icon: 'Timer' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(false)
    expect(res.blockErrors['b1'][0]).toContain('Start and end time cannot be the same')
  })

  it('5. Overlapping daytime activities rejected', () => {
    const blocks: ActivityDefinition[] = [
      { id: 'b1', name: 'Study Session', start: [9, 0], end: [12, 0], kind: 'study', icon: 'BookOpenText' },
      { id: 'b2', name: 'Meeting', start: [11, 0], end: [13, 0], kind: 'break', icon: 'Coffee' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(false)
    expect(res.overlaps.length).toBe(1)
    expect(res.blockErrors['b1'].some(e => e.includes('Overlaps with "Meeting"'))).toBe(true)
    expect(res.blockErrors['b2'].some(e => e.includes('Overlaps with "Study Session"'))).toBe(true)
  })

  it('6. Adjacent activities are valid (shared boundary)', () => {
    const blocks: ActivityDefinition[] = [
      { id: 'b1', name: 'Morning', start: [6, 30], end: [7, 0], kind: 'routine', icon: 'Sun' },
      { id: 'b2', name: 'Study 1', start: [7, 0], end: [10, 0], kind: 'study', icon: 'BookOpenText' },
      { id: 'b3', name: 'Break', start: [10, 0], end: [10, 30], kind: 'break', icon: 'Coffee' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(true)
    expect(res.overlaps.length).toBe(0)
  })

  it('7. Overnight activities accepted when non-overlapping', () => {
    // 23:00 to 07:00 sleep, 07:00 to 12:00 study
    const blocks: ActivityDefinition[] = [
      { id: 'sleep', name: 'Sleep', start: [23, 0], end: [7, 0], kind: 'sleep', icon: 'Moon' },
      { id: 'study', name: 'Study', start: [7, 0], end: [12, 0], kind: 'study', icon: 'BookOpenText' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(true)
    expect(res.overlaps.length).toBe(0)
  })

  it('8. Overnight overlap correctly rejected by midnight algorithm', () => {
    // 23:00 - 02:00 and 01:00 - 03:00 overlap between 01:00 and 02:00
    const blocks1: ActivityDefinition[] = [
      { id: 'sleep', name: 'Sleep', start: [23, 0], end: [2, 0], kind: 'sleep', icon: 'Moon' },
      { id: 'late', name: 'Late Study', start: [1, 0], end: [3, 0], kind: 'study', icon: 'Brain' },
    ]
    const res1 = validateSchedule(blocks1)
    expect(res1.isValid).toBe(false)
    expect(res1.overlaps.length).toBe(1)

    // However, 23:00 - 02:00 and 02:00 - 04:00 are adjacent -> ACCEPTED
    const blocks2: ActivityDefinition[] = [
      { id: 'sleep', name: 'Sleep', start: [23, 0], end: [2, 0], kind: 'sleep', icon: 'Moon' },
      { id: 'early', name: 'Early Work', start: [2, 0], end: [4, 0], kind: 'study', icon: 'Brain' },
    ]
    const res2 = validateSchedule(blocks2)
    expect(res2.isValid).toBe(true)
    expect(res2.overlaps.length).toBe(0)
  })

  it('9. Timetables with gaps are accepted', () => {
    const blocks: ActivityDefinition[] = [
      { id: 'b1', name: 'Morning Work', start: [8, 0], end: [11, 0], kind: 'study', icon: 'BookOpenText' },
      // Gap from 11:00 to 15:00
      { id: 'b2', name: 'Evening Work', start: [15, 0], end: [18, 0], kind: 'study', icon: 'BookOpenText' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(true)
    expect(res.overlaps.length).toBe(0)
  })

  it('10. Duplicate IDs rejected', () => {
    const blocks: ActivityDefinition[] = [
      { id: 'dup-id', name: 'Block 1', start: [8, 0], end: [10, 0], kind: 'study', icon: 'BookOpenText' },
      { id: 'dup-id', name: 'Block 2', start: [12, 0], end: [14, 0], kind: 'break', icon: 'Coffee' },
    ]
    const res = validateSchedule(blocks)
    expect(res.isValid).toBe(false)
    expect(res.blockErrors['dup-id'].some(e => e.includes('Duplicate'))).toBe(true)
  })

  it('11. Invalid icon or category rejected', () => {
    const badCategory: any[] = [
      { id: 'b1', name: 'Exercise', start: [8, 0], end: [9, 0], kind: 'workout', icon: 'BookOpenText' },
    ]
    const resCat = validateSchedule(badCategory as ActivityDefinition[])
    expect(resCat.isValid).toBe(false)
    expect(resCat.blockErrors['b1'].some(e => e.includes('Invalid category'))).toBe(true)

    const badIcon: any[] = [
      { id: 'b2', name: 'Exercise', start: [8, 0], end: [9, 0], kind: 'routine', icon: 'NotAnIcon' },
    ]
    const resIcon = validateSchedule(badIcon as ActivityDefinition[])
    expect(resIcon.isValid).toBe(false)
    expect(resIcon.blockErrors['b2'].some(e => e.includes('Invalid icon'))).toBe(true)
  })

  it('12. Preset name validation enforces length and case-insensitive uniqueness', () => {
    const existingPresets: Preset[] = [
      {
        id: 'p1',
        name: 'Deep Work Day',
        blocks: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    // Empty name
    expect(validatePresetName('', existingPresets).isValid).toBe(false)
    expect(validatePresetName('   ', existingPresets).isValid).toBe(false)

    // Name too long (> 40 chars)
    expect(validatePresetName('a'.repeat(41), existingPresets).isValid).toBe(false)

    // Duplicate name (case-insensitive)
    expect(validatePresetName('deep work day', existingPresets).isValid).toBe(false)
    expect(validatePresetName('DEEP WORK DAY', existingPresets).isValid).toBe(false)

    // Valid unique name
    expect(validatePresetName('Weekend Routine', existingPresets).isValid).toBe(true)

    // Renaming self to same name should be allowed
    expect(validatePresetName('Deep Work Day', existingPresets, 'p1').isValid).toBe(true)
  })
})
