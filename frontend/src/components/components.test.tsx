import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Feedback } from './Feedback'
import { Field } from './Field'

describe('공용 UI 접근성 계약', () => {
  it('Button은 loading 상태를 텍스트와 속성으로 알리고 중복 입력을 막는다', () => {
    render(<Button isLoading loadingLabel="행동을 바꾸는 중…">더 쉬운 행동 받기</Button>)

    const button = screen.getByRole('button', { name: '행동을 바꾸는 중…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('Field는 label, 도움말, 오류 문구를 입력에 연결한다', async () => {
    const user = userEvent.setup()
    render(
      <Field
        error="가능한 시간을 선택해 주세요."
        hint="5분, 15분, 30분 중 선택할 수 있어요."
        label="가능한 시간"
        name="availableMinutes"
      />,
    )

    const field = screen.getByRole('textbox', { name: '가능한 시간' })
    await user.tab()
    expect(field).toHaveFocus()
    expect(field).toHaveAccessibleDescription(/5분, 15분, 30분.*확인 필요/)
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    ['info', '안내', 'status', 'polite'],
    ['success', '완료', 'status', 'polite'],
    ['error', '확인 필요', 'alert', 'assertive'],
  ] as const)('%s Feedback은 색 외의 텍스트와 live region을 제공한다', (tone, label, role, live) => {
    render(<Feedback tone={tone} title="상태가 바뀌었어요">다음 행동을 확인해 주세요.</Feedback>)

    const feedback = screen.getByRole(role)
    expect(feedback).toHaveTextContent(label)
    expect(feedback).toHaveAttribute('aria-live', live)
  })
})
