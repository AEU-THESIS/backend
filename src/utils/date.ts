/**
 * Calculates the start date based on the specified period.
 */
export function getPeriodStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
  const date = new Date()
  if (period === 'daily') {
    date.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    date.setDate(date.getDate() - 7)
    date.setHours(0, 0, 0, 0)
  } else if (period === 'monthly') {
    date.setMonth(date.getMonth() - 1)
    date.setHours(0, 0, 0, 0)
  }
  return date
}
