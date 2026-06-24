export const getLocalTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export const formatLocalDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const parseLocalDate = (value) => {
  if (!value) {
    return new Date()
  }

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
  }

  const [year, month, day] = String(value).split('-').map(Number)

  if (!year || !month || !day) {
    const fallbackDate = new Date(value)
    return new Date(
      fallbackDate.getFullYear(),
      fallbackDate.getMonth(),
      fallbackDate.getDate(),
      12,
      0,
      0,
      0,
    )
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export const formatLongLocalDate = (value, locale = 'ru-RU') => {
  const date = parseLocalDate(value)

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export const isSameLocalDate = (left, right) => formatLocalDate(left) === formatLocalDate(right)
