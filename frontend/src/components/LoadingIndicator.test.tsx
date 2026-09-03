import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingIndicator } from './LoadingIndicator'

describe('LoadingIndicator', () => {
  it('exposes its progress text as a polite status', () => {
    render(<LoadingIndicator label="오늘의 행동 불러오는 중" />)

    expect(screen.getByRole('status')).toHaveTextContent('오늘의 행동 불러오는 중')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
