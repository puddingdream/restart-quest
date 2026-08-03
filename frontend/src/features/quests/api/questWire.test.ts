import assert from 'node:assert/strict'
import test from 'node:test'
import {
  toDailyQuestResponse,
  toRedesignQuestResponse,
  type DailyQuestWireResponse,
  type FailureRedesignWireResponse,
} from './questWire'

function quest(questId: string, revision = 1) {
  return {
    questId,
    revision,
    title: '행동 ' + revision,
    description: '작게 시작합니다.',
    completionCriteria: '한 단계를 마칩니다.',
    steps: ['첫 단계'],
    category: 'RESUME' as const,
    difficulty: 'EASY' as const,
    estimatedMinutes: 10,
    status: revision === 1 ? ('REDESIGNED' as const) : ('TODO' as const),
  }
}

test('daily wire의 questId를 화면 모델 id로 변환한다', () => {
  const wire: DailyQuestWireResponse = {
    date: '2026-08-03',
    energyLevel: 'LOW',
    generatedNow: true,
    journeys: [
      {
        journeyId: 'journey-1',
        status: 'ACTIVE',
        currentQuest: quest('quest-2', 2),
        history: [quest('quest-1')],
      },
    ],
  }

  const response = toDailyQuestResponse(wire)

  assert.equal(response.journeys[0]?.currentQuest.id, 'quest-2')
  assert.deepEqual(
    response.journeys[0]?.history.map(({ id }) => id),
    ['quest-1'],
  )
})

test('최상위 재설계 응답을 journey와 redesign 화면 모델로 조립한다', () => {
  const wire: FailureRedesignWireResponse = {
    journeyId: 'journey-1',
    status: 'ACTIVE',
    currentQuest: quest('quest-2', 2),
    history: [quest('quest-1')],
    redesign: {
      redesignId: 'redesign-1',
      journeyId: 'journey-1',
      originalQuestId: 'quest-1',
      replacementQuestId: 'quest-2',
      reasonCode: 'TASK_TOO_LARGE',
      reasonNote: null,
      createdAt: '2026-08-03T12:00:00+09:00',
    },
  }

  const response = toRedesignQuestResponse(wire)

  assert.equal(response.journey.currentQuest.id, 'quest-2')
  assert.equal(response.journey.history[0]?.id, 'quest-1')
  assert.equal(response.redesign.id, 'redesign-1')
  assert.equal(response.redesign.reasonNote, undefined)
})

test('mock 화면 모델 응답의 id와 중첩 journey를 그대로 보존한다', () => {
  const currentQuest = {
    ...quest('unused'),
    id: 'mock-quest-2',
    status: 'TODO' as const,
  }
  const journey = {
    journeyId: 'mock-journey',
    status: 'ACTIVE' as const,
    currentQuest,
    history: [],
  }
  const response = toRedesignQuestResponse({
    journey,
    redesign: {
      id: 'mock-redesign',
      journeyId: journey.journeyId,
      originalQuestId: 'mock-quest-1',
      replacementQuestId: currentQuest.id,
      reasonCode: 'LOW_ENERGY',
      createdAt: '2026-08-03T12:00:00+09:00',
    },
  })

  assert.equal(response.journey.currentQuest.id, 'mock-quest-2')
  assert.equal(response.redesign.id, 'mock-redesign')
})
