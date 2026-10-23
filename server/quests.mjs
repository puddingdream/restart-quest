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
  const step = STEPS[quest.level - 1];
  const reasonCode = quest.failureReason.code;
  return {
    parentId: quest.id,
    ...step,
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
