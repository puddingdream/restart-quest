export type QuestViewState =
  | 'NO_QUEST'
  | 'READY'
  | 'PENDING_ADAPTATION'
  | 'NEEDS_NEXT_ACTION'
  | 'QUEST_COMPLETED';

export type AsyncViewState = 'loading' | 'empty' | 'error' | 'ready';

export type BlockerCode =
  | 'TOO_BIG'
  | 'LOW_ENERGY'
  | 'UNCLEAR'
  | 'NO_TIME'
  | 'OTHER';

export interface QuestSummary {
  title: string;
}

export interface ActionSummary {
  title: string;
  estimatedMinutes: number;
}

export interface StartQuestValues {
  questTitle: string;
  actionTitle: string;
  estimatedMinutes: number;
}

export interface BlockerValues {
  blockerCode: BlockerCode;
  note: string;
}

export interface AdaptationValues {
  title: string;
  estimatedMinutes: number;
}

export interface HistoryItem {
  id: string;
  outcome: 'DONE' | 'BLOCKED';
  actionTitle: string;
  createdAtLabel: string;
  blockerLabel?: string;
  successorTitle?: string;
}
