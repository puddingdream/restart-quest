import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { QuestErrorFeedback } from '../questErrorFeedback'
import type { DailyQuestResponse, QuestJourney } from '../types'
import { TodayQuestContent } from './TodayQuestContent'

function createJourney(position: number): QuestJourney {
  const quest = {
    id: `quest-${position}`,
    title: `작은 퀘스트 ${position}`,
    description: `퀘스트 ${position} 설명`,
    completionCriteria: `완료 기준 ${position}`,
    steps: [`첫 단계 ${position}`, `두 번째 단계 ${position}`],
    category: 'RESUME' as const,
    difficulty: 'EASY' as const,
    estimatedMinutes: 10,
    status: 'TODO' as const,
    revision: 1,
  }
  return {
    journeyId: `journey-${position}`,
    status: 'ACTIVE',
    currentQuest: quest,
    history: [quest],
  }
}

const plan: DailyQuestResponse = {
  date: '2026-08-03',
  energyLevel: 'MEDIUM',
  generatedNow: true,
  journeys: [createJourney(1), createJourney(2), createJourney(3)],
}

const noop = () => undefined
const changeEnergy = () => undefined

function renderContent(
  overrides: Partial<Parameters<typeof TodayQuestContent>[0]> = {},
) {
  return renderToStaticMarkup(
    <TodayQuestContent
      plan={null}
      selectedEnergy={null}
      validationError={null}
      error={null}
      isLoading={false}
      isGenerating={false}
      onEnergyChange={changeEnergy}
      onGenerate={noop}
      onRetry={noop}
      {...overrides}
    />,
  )
}

test('empty 상태는 세 에너지 선택지와 생성 행동을 제공한다', () => {
  const markup = renderContent()

  assert.match(markup, /value="LOW"/)
  assert.match(markup, /value="MEDIUM"/)
  assert.match(markup, /value="HIGH"/)
  assert.match(markup, /오늘 퀘스트 만들기/)
  assert.match(markup, /컨디션을 평가하는 값이 아니에요/)
})

test('validation 상태는 에너지 입력과 연결된 오류를 알린다', () => {
  const markup = renderContent({
    validationError: '오늘 가능한 에너지를 하나 선택해 주세요.',
  })

  assert.match(markup, /aria-invalid="true"/)
  assert.match(markup, /id="energy-error" role="alert"/)
  assert.match(markup, /오늘 가능한 에너지를 하나 선택해 주세요/)
})

test('생성 중에는 제출을 막고 정확히 세 카드 skeleton을 표시한다', () => {
  const markup = renderContent({
    selectedEnergy: 'MEDIUM',
    isGenerating: true,
  })

  assert.match(markup, /오늘 퀘스트를 만들고 있어요/)
  assert.match(markup, /disabled=""/)
  assert.equal((markup.match(/quest-card-skeleton/g) ?? []).length, 3)
  assert.match(markup, /role="status"/)
})

test('생성 후 세 여정의 currentQuest, 완료 기준과 steps를 카드로 표시한다', () => {
  const markup = renderContent({ plan })

  assert.equal((markup.match(/<article class="quest-card"/g) ?? []).length, 3)
  assert.equal((markup.match(/완료 기준 [1-3]/g) ?? []).length, 3)
  assert.equal((markup.match(/첫 단계 [1-3]/g) ?? []).length, 3)
  assert.equal((markup.match(/aria-labelledby="quest-journey-/g) ?? []).length, 3)
  assert.match(markup, /aria-label="오늘의 퀘스트 세 개"/)
})

test('AI 오류는 입력을 유지한 재시도 상태를 제공한다', () => {
  const error: QuestErrorFeedback = {
    code: 'AI_PROVIDER_TIMEOUT',
    source: 'generate',
    title: '퀘스트를 준비하는 데 평소보다 오래 걸렸어요',
    message: '중복 생성되지 않으니 안심하고 다시 확인해 주세요.',
  }
  const markup = renderContent({ selectedEnergy: 'HIGH', error })

  assert.match(markup, /role="alert"/)
  assert.match(markup, /checked="" value="HIGH"/)
  assert.match(markup, /다시 시도/)
})
