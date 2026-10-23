import { randomUUID } from 'node:crypto';

export const STATES = Object.freeze(['ready', 'low_energy', 'overwhelmed']);
export const REASONS = Object.freeze(['time', 'energy', 'too_hard', 'unclear', 'other']);

export const STEPS = Object.freeze([
  Object.freeze({ level: 0, minutes: 2, title: '관심 직무 키워드 1개 적기', instruction: '지금 떠오르는 키워드 한 단어만 적으세요.' }),
  Object.freeze({ level: 1, minutes: 5, title: '관심 직무 키워드 1개와 이유 적기', instruction: '키워드 1개와 관심이 가는 이유 한 줄을 적으세요.' }),
  Object.freeze({ level: 2, minutes: 10, title: '관심 직무 키워드 2개와 이유 적기', instruction: '떠오르는 직무 키워드 2개와 그중 하나를 고른 이유 한 줄을 적으세요.' }),
  Object.freeze({ level: 3, minutes: 20, title: '관심 직무 키워드 3개 적기', instruction: '떠오르는 직무 키워드 3개와 그중 하나를 고른 이유 한 줄을 적으세요.' })
]);

export const RATIONALES = Object.freeze({
  time: '필요 시간을 줄였어요',
  energy: '지금 상태에 맞춰 한 단계 줄였어요',
  too_hard: '할 일을 더 작게 나눴어요',
  unclear: '할 일을 구체적인 한 단계로 좁혔어요',
  other: '다시 시작하기 쉽게 한 단계 줄였어요'
});

// Index by the child's level. The generic steps remain valid for quests
// persisted before reason-specific redesigns were introduced.
export const REDESIGN_ACTIONS = Object.freeze({
  time: Object.freeze([
    Object.freeze({ title: '직무명 첫 글자 적기', instruction: '떠오르는 직무명의 첫 글자 하나만 적고 멈추세요.' }),
    Object.freeze({ title: '직무 키워드 1개만 적기', instruction: '자료 조사나 이유 없이 떠오르는 직무명 하나만 적으세요.' }),
    Object.freeze({ title: '직무 키워드 2개만 적기', instruction: '이유를 쓰거나 자료를 찾지 말고, 떠오르는 직무명 두 개만 적으세요.' })
  ]),
  energy: Object.freeze([
    Object.freeze({ title: '예시 직무 하나 표시하기', instruction: '기획·디자인 중 덜 부담스러운 것 하나만 동그라미 치거나 적으세요.' }),
    Object.freeze({ title: '예시 직무에서 1개 고르기', instruction: '기획·디자인·개발 중 지금 덜 부담스러운 직무 하나만 골라 적으세요.' }),
    Object.freeze({ title: '예시 직무에서 2개 고르기', instruction: '새로 찾지 말고 기획·디자인·개발 중 부담 없는 직무 두 개만 골라 적으세요.' })
  ]),
  too_hard: Object.freeze([
    Object.freeze({ title: '업무 동사 첫 글자 적기', instruction: '쓰기·만들기 중 해보고 싶은 동작의 첫 글자 하나만 적으세요.' }),
    Object.freeze({ title: '해보고 싶은 업무 동사 1개 적기', instruction: '직무명을 정하지 말고 쓰기·만들기·정리하기 중 해보고 싶은 동작 하나만 적으세요.' }),
    Object.freeze({ title: '해보고 싶은 업무 동사 2개 적기', instruction: '직무명을 결정하지 말고, 쓰기·만들기·정리하기처럼 해보고 싶은 동작 두 개만 적으세요.' })
  ]),
  unclear: Object.freeze([
    Object.freeze({ title: '일의 첫 글자 한 칸 채우기', instruction: '‘해보고 싶은 일: ___’의 빈칸에 떠오르는 업무 동사의 첫 글자 하나만 넣으세요.' }),
    Object.freeze({ title: '하고 싶은 일 한 칸 채우기', instruction: '‘해보고 싶은 일: ___’의 빈칸에 업무 동사 하나만 넣으세요.' }),
    Object.freeze({ title: '하고 싶은 일 두 칸 채우기', instruction: '‘해보고 싶은 일: ___, ___’의 두 빈칸에 업무 동사 하나씩 넣으세요.' })
  ]),
  other: STEPS
});

export function initialLevel(availableMinutes, currentState) {
  if (currentState === 'ready' && availableMinutes >= 20) return 3;
  if ((currentState === 'ready' || currentState === 'low_energy') && availableMinutes >= 10) return 2;
  return 1;
}

export function createQuest({ availableMinutes, currentState }, now = new Date().toISOString(), id = randomUUID()) {
  const level = initialLevel(availableMinutes, currentState);
  return {
    id,
    rootId: id,
    parentId: null,
    createdAt: now,
    status: 'pending',
    completedAt: null,
    failedAt: null,
    availableMinutes,
    currentState,
    ...STEPS[level],
    failureReason: null,
    redesignReason: null
  };
}

export function suggestRedesign(quest) {
  if (quest.status !== 'failed' || quest.level === 0) return null;
  const reasonCode = quest.failureReason.code;
  const level = quest.level - 1;
  return {
    parentId: quest.id,
    ...STEPS[level],
    ...REDESIGN_ACTIONS[reasonCode][level],
    reasonCode,
    rationale: RATIONALES[reasonCode]
  };
}

export function createRedesign(parent, now = new Date().toISOString(), id = randomUUID()) {
  const suggestion = suggestRedesign(parent);
  if (!suggestion) return null;
  const { level, minutes, title, instruction } = suggestion;
  return {
    id,
    rootId: parent.rootId,
    parentId: parent.id,
    createdAt: now,
    status: 'pending',
    completedAt: null,
    failedAt: null,
    availableMinutes: parent.availableMinutes,
    currentState: parent.currentState,
    level,
    minutes,
    title,
    instruction,
    failureReason: null,
    redesignReason: parent.failureReason.code
  };
}

function newestFirst(a, b) {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export function buildDashboard(quests) {
  const ordered = [...quests].sort(newestFirst);
  const summary = { total: ordered.length, pending: 0, completed: 0, failed: 0, redesigned: 0 };
  for (const quest of ordered) {
    summary[quest.status] += 1;
    if (quest.parentId !== null) summary.redesigned += 1;
  }
  const parentIds = new Set(ordered.filter((quest) => quest.parentId !== null).map((quest) => quest.parentId));
  return {
    summary,
    quests: ordered,
    nextActions: ordered.filter((quest) => quest.status === 'pending'),
    suggestions: ordered
      .filter((quest) => quest.status === 'failed' && quest.level > 0 && !parentIds.has(quest.id))
      .map(suggestRedesign)
  };
}
