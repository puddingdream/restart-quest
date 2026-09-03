import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('provides the accessible shell and product boundary copy', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '막히면 더 작게, 오늘 다시 시작하기' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '본문으로 건너뛰기' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(screen.getByRole('link', { name: '작게 시작하는 방법' })).toHaveAttribute(
      'href',
      '#restart-guide',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByText(/전문 상담이나 의료 서비스를 대신하지 않습니다/)).toBeVisible()
  })
})
