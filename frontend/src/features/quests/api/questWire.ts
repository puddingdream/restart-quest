import type {
  DailyQuestResponse,
  EnergyLevel,
  Quest,
  QuestCategory,
  QuestDifficulty,
  QuestFailureReasonCode,
  QuestJourney,
  QuestRedesign,
  RedesignQuestResponse,
} from '../types'

interface QuestWireResponse {
  questId: string
  revision: number
  title: string
  description: string
  completionCriteria: string
  steps: string[]
  category: QuestCategory
  difficulty: QuestDifficulty
  estimatedMinutes: number
  status: Quest['status']
}

type QuestApiResponse = QuestWireResponse | Quest

interface QuestJourneyWireResponse {
  journeyId: string
  status: QuestJourney['status']
  currentQuest: QuestApiResponse
  history: QuestApiResponse[]
}

export type QuestJourneyApiResponse = QuestJourneyWireResponse | QuestJourney

export interface DailyQuestWireResponse {
  date: string
  energyLevel: EnergyLevel | null
  generatedNow: boolean
  journeys: QuestJourneyApiResponse[]
}

interface QuestRedesignWireResponse {
  redesignId: string
  journeyId: string
  originalQuestId: string
  replacementQuestId: string
  reasonCode: QuestFailureReasonCode
  reasonNote: string | null
  createdAt: string
}

export interface FailureRedesignWireResponse extends QuestJourneyWireResponse {
  redesign: QuestRedesignWireResponse
}

export type FailureRedesignApiResponse =
  | FailureRedesignWireResponse
  | RedesignQuestResponse

function toQuest(wire: QuestApiResponse): Quest {
  if ('id' in wire) return wire
  return {
    id: wire.questId,
    title: wire.title,
    description: wire.description,
    completionCriteria: wire.completionCriteria,
    steps: wire.steps,
    category: wire.category,
    difficulty: wire.difficulty,
    estimatedMinutes: wire.estimatedMinutes,
    status: wire.status,
    revision: wire.revision,
  }
}

export function toQuestJourney(
  wire: QuestJourneyApiResponse,
): QuestJourney {
  return {
    journeyId: wire.journeyId,
    status: wire.status,
    currentQuest: toQuest(wire.currentQuest),
    history: wire.history.map(toQuest),
  }
}

export function toDailyQuestResponse(
  wire: DailyQuestWireResponse,
): DailyQuestResponse {
  return {
    date: wire.date,
    energyLevel: wire.energyLevel,
    generatedNow: wire.generatedNow,
    journeys: wire.journeys.map(toQuestJourney),
  }
}

function toQuestRedesign(wire: QuestRedesignWireResponse): QuestRedesign {
  return {
    id: wire.redesignId,
    journeyId: wire.journeyId,
    originalQuestId: wire.originalQuestId,
    replacementQuestId: wire.replacementQuestId,
    reasonCode: wire.reasonCode,
    ...(wire.reasonNote === null ? {} : { reasonNote: wire.reasonNote }),
    createdAt: wire.createdAt,
  }
}

export function toRedesignQuestResponse(
  wire: FailureRedesignApiResponse,
): RedesignQuestResponse {
  if ('journey' in wire) return wire
  return {
    journey: toQuestJourney(wire),
    redesign: toQuestRedesign(wire.redesign),
  }
}
