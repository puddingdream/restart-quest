import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('announces one busy state and prevents duplicate interaction', () => {
    render(
      <Button isLoading loadingLabel="저장 중">
        저장하기
      </Button>,
    )

    const button = screen.getByRole('button', { name: '저장 중' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('저장하기')).not.toBeInTheDocument()
  })
})
