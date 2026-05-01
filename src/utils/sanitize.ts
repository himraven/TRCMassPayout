export function normalizeUserText(value: string, maxLength = 160) {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127 ? ' ' : character
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

function stripHtmlTags(value: string) {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<\/?[^>]+>/g, '')
}

export function sanitizeUserText(value: string, maxLength = 160) {
  return normalizeUserText(stripHtmlTags(value), maxLength)
}

export function sanitizeNumericInput(
  value: number,
  { min, max, fallback }: { min: number; max: number; fallback: number },
) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}