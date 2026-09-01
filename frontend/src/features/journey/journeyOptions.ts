import type {
  AvailableMinutes,
  EnergyLevel,
  FrictionReason,
  GoalType,
} from '../../api/contracts'

export const goalOptions: ReadonlyArray<{ value: GoalType; label: string; hint: string }> = [
  { value: 'JOB_SEARCH', label: '구직 활동', hint: '공고 탐색을 다시 잇고 싶어요.' },
  { value: 'RESUME', label: '이력서', hint: '경험과 문장을 조금 다듬고 싶어요.' },
  { value: 'NETWORKING', label: '네트워킹', hint: '사람과의 연결을 가볍게 시작하고 싶어요.' },
]

export const energyOptions: ReadonlyArray<{ value: EnergyLevel; label: string; hint: string }> = [
  { value: 'LOW', label: '낮아요', hint: '준비가 거의 없는 행동이 좋아요.' },
  { value: 'MEDIUM', label: '보통이에요', hint: '짧게 집중할 수 있어요.' },
  { value: 'HIGH', label: '충분해요', hint: '조금 더 구체적인 행동도 괜찮아요.' },
]

export const minuteOptions: ReadonlyArray<{ value: AvailableMinutes; label: string }> = [
  { value: 5, label: '5분' },
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
]

export const frictionOptions: ReadonlyArray<{ value: FrictionReason; label: string }> = [
  { value: 'TOO_BIG', label: '행동이 지금은 크게 느껴져요' },
  { value: 'UNCLEAR', label: '어디서 시작할지 선명하지 않아요' },
  { value: 'LOW_ENERGY', label: '쓸 수 있는 에너지가 적어요' },
  { value: 'MISSING_MATERIAL', label: '필요한 자료가 곁에 없어요' },
  { value: 'OTHER', label: '지금 상황과 잘 맞지 않아요' },
]
