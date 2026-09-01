import { describe, expect, it } from 'vitest'
import globalStyles from './global.css?raw'
import tokens from './tokens.css?raw'

describe('반응형 및 motion 시각 계약', () => {
  it('44px 제어 영역과 720px 읽기 폭을 토큰으로 고정한다', () => {
    expect(tokens).toContain('--control-min-size: 2.75rem')
    expect(tokens).toContain('--content-width: 45rem')
    expect(globalStyles).toContain('min-block-size: var(--control-min-size)')
    expect(globalStyles).toContain('width: min(100% - 2rem, var(--content-width))')
  })

  it('360px은 세로 action, 768px 이상은 제한된 가로 action을 사용한다', () => {
    expect(globalStyles).toMatch(/\.action-row\s*\{[^}]*display:\s*grid/s)
    expect(globalStyles).toMatch(/@media \(min-width: 48rem\)[\s\S]*grid-auto-flow:\s*column/)
    expect(globalStyles).toMatch(/@media \(max-width: 30rem\)[\s\S]*\.button\s*\{[^}]*width:\s*100%/)
  })

  it('focus indicator와 reduced-motion 대체를 항상 제공한다', () => {
    expect(globalStyles).toMatch(/:focus-visible\s*\{[^}]*outline:/s)
    expect(globalStyles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(globalStyles).toContain('transition-duration: 0.01ms !important')
    expect(globalStyles).toContain('animation-duration: 0.01ms !important')
  })
})
