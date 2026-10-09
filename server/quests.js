import { randomUUID } from 'node:crypto';

const options = {
  low: [
    [5, '관심 직무 한 개 적기', '떠오르는 직무 이름 한 개를 메모한다.'],
    [10, '관심 회사 한 곳 찾아보기', '관심 회사 한 곳의 이름과 이유 한 줄을 적는다.'],
    [15, '공고 한 개 읽기', '공고 한 개를 읽고 눈에 띈 요구사항 한 줄을 적는다.'],
  ],
  medium: [
    [5, '지원 후보 한 곳 저장하기', '나중에 볼 회사나 공고 한 곳을 저장한다.'],
    [10, '공고의 핵심 요건 표시하기', '공고 한 개에서 핵심 요건 한 가지를 적는다.'],
    [20, '경험 한 항목 초안 쓰기', '지원에 쓸 경험 한 항목을 두세 문장으로 적는다.'],
  ],
  high: [
    [5, '지원 후보 한 곳 저장하기', '나중에 볼 회사나 공고 한 곳을 저장한다.'],
    [15, '경험 사례 하나 고르기', '지원 직무와 닿는 경험 사례 하나를 골라 제목을 적는다.'],
    [25, '경험 사례 한 항목 작성하기', '사례 하나의 상황·행동·결과를 짧게 적는다.'],
  ],
};

export function validateInput(input) {
  const fields = Object.create(null);
  for (const key of Object.keys(input)) {
    if (key !== 'availableMinutes' && key !== 'energy') fields[key] = '알 수 없는 필드입니다.';
  }
  if (!Number.isInteger(input.availableMinutes) || input.availableMinutes < 5 || input.availableMinutes > 120) {
    fields.availableMinutes = '5~120 사이의 정수가 필요합니다.';
  }
  if (typeof input.energy !== 'string' || !Object.hasOwn(options, input.energy)) {
    fields.energy = 'low, medium, high 중 하나를 선택해 주세요.';
  }
  return fields;
}

export function createQuest(input) {
  const choices = options[input.energy];
  const [estimatedMinutes, title, description] = choices.findLast(([minutes]) => minutes <= input.availableMinutes);
  const id = randomUUID();
  return {
    id,
    createdAt: new Date().toISOString(),
    availableMinutes: input.availableMinutes,
    energy: input.energy,
    title,
    description,
    estimatedMinutes,
    status: 'pending',
    failureReason: null,
    completedAt: null,
    failedAt: null,
    parentQuestId: null,
    rootQuestId: id,
  };
}
