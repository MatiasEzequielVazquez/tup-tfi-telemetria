/** Un texto como entero positivo (1, 2, 3…), o `null` si no lo es. Sin espacios sobrantes ni decimales. */
export const parsePositiveInteger = (raw: string): number | null => {
  const text = raw.trim()
  if (text === '') return null
  const value = Number(text)
  return Number.isInteger(value) && value > 0 ? value : null
}
