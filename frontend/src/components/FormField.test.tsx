import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'

describe('FormField', () => {
  it('connects the label, hint, and visible error to the input', () => {
    render(
      <FormField
        id="email"
        label="이메일"
        hint="로그인에 사용할 주소예요."
        error="올바른 이메일을 입력해 주세요."
        type="email"
      />,
    )

    const input = screen.getByRole('textbox', { name: '이메일' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      '로그인에 사용할 주소예요. 올바른 이메일을 입력해 주세요.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('올바른 이메일을 입력해 주세요.')
  })
})
