import { describe, expect, it } from 'vitest'
import {
  ATELIER_ORIGINAL_SCHEDULE,
  formatDuration,
  formatMinutes,
  getCategoryTotals,
  getCurrentSegment,
  getNextSegment,
  getStudyOverview,
  getUpcomingSegments,
  makeSegments,
  sortActivitiesChronologically,
  type ActivityDefinition,
} from '../schedule'

describe('Schedule Engine', () => {
  it('1. Original preset totals exactly match 24 hours (1440 minutes)', () => {
    const totals = getCategoryTotals(ATELIER_ORIGINAL_SCHEDULE)
    expect(totals.totalScheduled).toBe(1440)
    expect(totals.unallocated).toBe(0)
    expect(totals.study).toBe(750) // 12h 30m
    expect(totals.sleep).toBe(450) // 7h 30m
    expect(totals.break).toBe(210) // 3h 30m
    expect(totals.routine).toBe(30) // 30m
  })

  it('2. Original current activity resolution works at various times', () => {
    // 08:00 AM should be in Study Session 1 (07:00 - 10:00)
    const d8am = new Date(2026, 4, 15, 8, 0, 0).getTime()
    const seg8am = getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d8am)
    expect(seg8am).not.toBeNull()
    expect(seg8am?.id).toBe('study-1')
    expect(seg8am?.name).toBe('Study Session 1')
    expect(seg8am?.kind).toBe('study')

    // 14:30 should be Lunch (14:00 - 15:00)
    const d230pm = new Date(2026, 4, 15, 14, 30, 0).getTime()
    const seg230pm = getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d230pm)
    expect(seg230pm).not.toBeNull()
    expect(seg230pm?.id).toBe('lunch')
    expect(seg230pm?.name).toBe('Lunch')
  })

  it('3. Current activity changes at exact boundaries (start-inclusive, end-exclusive)', () => {
    // Study Session 1: 07:00 to 10:00
    // Breakfast: 10:00 to 10:30
    const d959 = new Date(2026, 4, 15, 9, 59, 59).getTime()
    const d1000 = new Date(2026, 4, 15, 10, 0, 0).getTime()
    const d1029 = new Date(2026, 4, 15, 10, 29, 59).getTime()
    const d1030 = new Date(2026, 4, 15, 10, 30, 0).getTime()

    expect(getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d959)?.id).toBe('study-1')
    expect(getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d1000)?.id).toBe('breakfast')
    expect(getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d1029)?.id).toBe('breakfast')
    expect(getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d1030)?.id).toBe('break-am')
  })

  it('4. A schedule with gaps returns null during the gap', () => {
    const gappedSchedule: ActivityDefinition[] = [
      { id: 'work', name: 'Work', start: [9, 0], end: [12, 0], kind: 'study', icon: 'BookOpenText' },
      { id: 'gym', name: 'Gym', start: [17, 0], end: [18, 0], kind: 'routine', icon: 'Dumbbell' },
    ]

    // 10:00 AM -> during 'work'
    const d10am = new Date(2026, 4, 15, 10, 0, 0).getTime()
    expect(getCurrentSegment(gappedSchedule, d10am)?.id).toBe('work')

    // 14:00 (2 PM) -> in the unscheduled gap
    const d2pm = new Date(2026, 4, 15, 14, 0, 0).getTime()
    expect(getCurrentSegment(gappedSchedule, d2pm)).toBeNull()

    // Next segment during gap should be 'gym'
    const next = getNextSegment(gappedSchedule, d2pm)
    expect(next?.id).toBe('gym')
  })

  it('5. Upcoming activities resolve across midnight in chronological order', () => {
    const schedule: ActivityDefinition[] = [
      { id: 'evening', name: 'Late Work', start: [22, 0], end: [23, 30], kind: 'study', icon: 'Brain' },
      { id: 'morning', name: 'Early Jog', start: [6, 0], end: [7, 0], kind: 'routine', icon: 'Sun' },
    ]

    // At 23:00, upcoming should show tomorrow morning's 'Early Jog'
    const d23 = new Date(2026, 4, 15, 23, 0, 0).getTime()
    const upcoming = getUpcomingSegments(schedule, d23, 2)
    expect(upcoming.length).toBeGreaterThanOrEqual(1)
    expect(upcoming[0].id).toBe('morning')
    expect(new Date(upcoming[0].startMs).getDate()).toBe(16) // next day!
  })

  it('6. An overnight block remains active after midnight', () => {
    // Atelier Original sleep: 23:00 to 06:30
    // At 02:00 AM on the following day
    const d2am = new Date(2026, 4, 16, 2, 0, 0).getTime()
    const seg2am = getCurrentSegment(ATELIER_ORIGINAL_SCHEDULE, d2am)
    expect(seg2am).not.toBeNull()
    expect(seg2am?.id).toBe('sleep')
    expect(seg2am?.name).toBe('Sleep')
    expect(seg2am?.endMs).toBeGreaterThan(d2am)
    expect(seg2am?.startMs).toBeLessThan(d2am)
  })

  it('7. Dynamic scheduled-study totals calculate properly for custom schedules', () => {
    const customSchedule: ActivityDefinition[] = [
      { id: 's1', name: 'Coding', start: [8, 0], end: [11, 0], kind: 'study', icon: 'Code2' }, // 3h = 180m
      { id: 's2', name: 'Reading', start: [14, 0], end: [16, 30], kind: 'study', icon: 'BookOpenText' }, // 2.5h = 150m
      { id: 'b1', name: 'Lunch', start: [12, 0], end: [13, 0], kind: 'break', icon: 'Utensils' }, // 1h = 60m
    ]

    const totals = getCategoryTotals(customSchedule)
    expect(totals.study).toBe(330) // 5h 30m = 330 minutes
    expect(totals.break).toBe(60)
    expect(totals.totalScheduled).toBe(390)
    expect(totals.unallocated).toBe(1440 - 390) // 1050 minutes

    const overview = getStudyOverview(customSchedule, new Date(2026, 4, 15, 7, 0, 0).getTime())
    expect(overview.scheduledStudyMs).toBe(330 * 60 * 1000)
    expect(overview.elapsed).toBe(0)
    expect(overview.remaining).toBe(330 * 60 * 1000)
    expect(overview.totalStudySessions).toBe(2)
  })

  it('8. A study block crossing midnight is correctly attributed to calendar days', () => {
    // Overnight study: 22:00 to 02:00 (4 hours total: 2 hours today, 2 hours tomorrow)
    const overnightStudy: ActivityDefinition[] = [
      { id: 'night-study', name: 'Night Study', start: [22, 0], end: [2, 0], kind: 'study', icon: 'Brain' },
    ]

    // At 23:00 on day 15:
    // - 2 hours elapsed from the previous day's session crossing into today (00:00 to 02:00)
    // - 1 hour elapsed from today's session (22:00 to 23:00)
    // Total elapsed today = 3 hours (10,800,000 ms)
    const d23 = new Date(2026, 4, 15, 23, 0, 0).getTime()
    const overview23 = getStudyOverview(overnightStudy, d23)
    expect(overview23.elapsed).toBe(3 * 3600 * 1000)

    // At 01:00 on day 16: on day 16, 1 hour has elapsed since midnight (00:00 to 01:00)
    const d01 = new Date(2026, 4, 16, 1, 0, 0).getTime()
    const overview01 = getStudyOverview(overnightStudy, d01)
    expect(overview01.elapsed).toBe(1 * 3600 * 1000)
  })

  it('9. A timetable with no study blocks produces safe statistics', () => {
    const noStudySchedule: ActivityDefinition[] = [
      { id: 'walk', name: 'Walk', start: [8, 0], end: [9, 0], kind: 'routine', icon: 'Compass' },
      { id: 'relax', name: 'Relax', start: [12, 0], end: [14, 0], kind: 'break', icon: 'Coffee' },
    ]

    const overview = getStudyOverview(noStudySchedule, new Date(2026, 4, 15, 10, 0, 0).getTime())
    expect(overview.scheduledStudyMs).toBe(0)
    expect(overview.elapsed).toBe(0)
    expect(overview.remaining).toBe(0)
    expect(overview.totalStudySessions).toBe(0)
    expect(overview.currentStudyNumber).toBeUndefined()
  })

  it('10. Different numbers of study blocks produce correct numbering', () => {
    const twoSessions: ActivityDefinition[] = [
      { id: 's1', name: 'Session 1', start: [8, 0], end: [11, 0], kind: 'study', icon: 'BookOpenText' },
      { id: 's2', name: 'Session 2', start: [14, 0], end: [17, 0], kind: 'study', icon: 'BookOpenText' },
    ]

    const segs = makeSegments(twoSessions, new Date(2026, 4, 15, 12, 0, 0).getTime(), 0, 0)
    expect(segs.length).toBe(2)
    expect(segs[0].studyNumber).toBe(1)
    expect(segs[0].studyTotal).toBe(2)
    expect(segs[1].studyNumber).toBe(2)
    expect(segs[1].studyTotal).toBe(2)

    // Test chronological sorting helper
    const unsorted: ActivityDefinition[] = [
      { id: 'later', name: 'Later', start: [18, 0], end: [19, 0], kind: 'routine', icon: 'Sun' },
      { id: 'earlier', name: 'Earlier', start: [7, 0], end: [8, 0], kind: 'study', icon: 'Brain' },
    ]
    const sorted = sortActivitiesChronologically(unsorted)
    expect(sorted[0].id).toBe('earlier')
    expect(sorted[1].id).toBe('later')
  })

  it('11. Duration formatting helpers function accurately', () => {
    expect(formatMinutes(90)).toBe('1h 30m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatDuration(3665 * 1000, true)).toBe('1h 01m 05s')
    expect(formatDuration(3600 * 1000)).toBe('1h')
  })
})
