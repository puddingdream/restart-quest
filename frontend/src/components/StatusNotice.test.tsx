import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusNotice } from './StatusNotice'

describe('StatusNotice', () => {
  it('uses text and a named region in addition to its visual tone', () => {
    render(
      <StatusNotice
        tone="error"
        title="저장하지 못했어요"
        description="입력은 유지했어요. 다시 시도해 주세요."
      />,
    )

    const notice = screen.getByRole('region', { name: '저장하지 못했어요' })
    expect(notice).toHaveClass('status-notice--error')
    expect(notice).toHaveTextContent('입력은 유지했어요. 다시 시도해 주세요.')
  })
})
