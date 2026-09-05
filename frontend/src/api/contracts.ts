export const NEXT_REQUIRED_ACTIONS = [
  'CREATE_QUEST',
  'DO_READY_ACTION',
  'ADAPT_BLOCKED_ACTION',
  'CREATE_NEXT_ACTION_OR_COMPLETE',
  'START_NEW_QUEST',
] as const;

export type NextRequiredAction = (typeof NEXT_REQUIRED_ACTIONS)[number];

export type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type ActionStatus = 'READY' | 'DONE' | 'BLOCKED' | 'CANCELLED';
export type AttemptOutcome = 'DONE' | 'BLOCKED';
export type BlockerCode = 'TOO_BIG' | 'LOW_ENERGY' | 'UNCLEAR' | 'NO_TIME' | 'OTHER';

export interface Workspace {
  id: string;
  timezone: string;
}

export interface Quest {
  id: string;
  status: QuestStatus;
  title: string;
  version: number;
  createdAt: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface QuestAction {
  id: string;
  questId: string;
  status: ActionStatus;
  title: string;
  estimatedMinutes: number;
  sourceAttemptId?: string;
  createdAt: string;
  endedAt?: string;
}

export interface Attempt {
  id: string;
  actionId: string;
  outcome: AttemptOutcome;
  blockerCode?: BlockerCode;
  note?: string;
  createdAt: string;
}

export interface AdaptationSuggestion {
  strategyCode: string;
  guidance: string;
  title: string;
  estimatedMinutes: number;
}

export interface PendingAdaptation {
  attempt: Attempt;
  suggestion: AdaptationSuggestion;
}

export interface HistoryEntry {
  attempt: Attempt;
  action: QuestAction;
  successorAction?: QuestAction;
}

export interface SessionResponse {
  csrfToken: string;
  workspaceExpiresAt: string;
}

export interface BootstrapResponse {
  workspace: Workspace;
  activeQuest: Quest | null;
  currentAction: QuestAction | null;
  pendingAdaptation: PendingAdaptation | null;
  recentAttempts: HistoryEntry[];
  nextRequiredAction: NextRequiredAction;
  csrfToken: string;
  workspaceExpiresAt: string;
}

export interface HistoryResponse {
  items: HistoryEntry[];
  nextCursor: string | null;
}

export interface NextActionResponse {
  nextRequiredAction: NextRequiredAction;
}

export interface CreateQuestRequest {
  title: string;
  firstAction: {
    title: string;
    estimatedMinutes: number;
  };
}

export interface CreateQuestResponse extends NextActionResponse {
  quest: Quest;
  action: QuestAction;
}

export interface ActionInput {
  title: string;
  estimatedMinutes: number;
}

export interface ActionResponse extends NextActionResponse {
  action: QuestAction;
}

export interface AttemptRequest {
  outcome: AttemptOutcome;
  blockerCode?: BlockerCode;
  note?: string;
}

export interface AttemptResponse extends NextActionResponse {
  attempt: Attempt;
  suggestion?: AdaptationSuggestion;
}

export interface VersionRequest {
  version: number;
}

export interface QuestResponse extends NextActionResponse {
  quest: Quest;
}

export interface FieldError {
  field: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  fieldErrors: FieldError[];
  traceId?: string;
}
