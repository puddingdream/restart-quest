import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/tokens.css'
import './styles/global.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('애플리케이션 루트 요소를 찾을 수 없습니다.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
