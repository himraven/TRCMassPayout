import { describe, expect, it } from 'vitest'
import { sanitizeUserText } from '../sanitize'

describe('sanitize utils', () => {
  it('strips html tags', () => {
    expect(sanitizeUserText('<b>Hello</b>')).toBe('Hello')
  })

  it('neutralizes script injection', () => {
    expect(sanitizeUserText('hello\u0000<script>alert(1)</script>')).toBe('hello')
  })

  it('passes normal text through unchanged', () => {
    expect(sanitizeUserText('Normal payout recipient')).toBe('Normal payout recipient')
  })
})