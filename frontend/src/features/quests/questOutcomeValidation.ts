import type {
  QuestFailureReasonCode,
  RedesignQuestRequest,
} from './types'

export const QUEST_REASON_NOTE_MAX_LENGTH = 300

export interface RedesignFormValues {
  reasonCode: QuestFailureReasonCode | ''
  reasonNote: string
}

export interface RedesignFormErrors {
  reasonCode?: string
  reasonNote?: string
}

export function validateRedesignForm(
  values: RedesignFormValues,
): RedesignFormErrors {
  const errors: RedesignFormErrors = {}
  if (!values.reasonCode) {
    errors.reasonCode = '더 작게 바꾸려는 이유를 하나 선택해 주세요.'
  }
  if (values.reasonNote.length > QUEST_REASON_NOTE_MAX_LENGTH) {
    errors.reasonNote = '메모는 300자 이내로 적어 주세요.'
  }
  return errors
}

export function toRedesignQuestRequest(
  values: RedesignFormValues,
): RedesignQuestRequest | null {
  if (Object.keys(validateRedesignForm(values)).length > 0 || !values.reasonCode) {
    return null
  }

  const reasonNote = values.reasonNote.trim()
  return {
    reasonCode: values.reasonCode,
    ...(reasonNote ? { reasonNote } : {}),
  }
}
