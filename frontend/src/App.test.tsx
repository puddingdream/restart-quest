import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './App'

function renderRoute(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('API 없이 랜딩을 렌더링하고 키보드로 시작 화면에 진입한다', async () => {
    const user = userEvent.setup()
    renderRoute()

    expect(screen.getByRole('heading', { level: 1, name: /멈춘 준비를/ })).toBeVisible()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')

    await user.tab()
    expect(screen.getByRole('link', { name: '본문으로 바로가기' })).toHaveFocus()
    await user.tab()
    await user.tab()

    const startButton = screen.getByRole('button', { name: '오늘의 작은 행동 만들기' })
    expect(startButton).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('heading', { level: 1, name: /오늘 가능한 만큼/ })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('화면 준비 중')
  })

  it.each([
    ['/start', '오늘 가능한 만큼만 알려 주세요'],
    ['/quest', '한 번에 한 가지에 집중해요'],
  ])('%s 라우트가 도메인 데이터 없이 렌더링된다', (path, heading) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  })
})
