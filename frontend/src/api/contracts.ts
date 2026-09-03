import { z } from 'zod'

export const goalTypeSchema = z.enum(['JOB_SEARCH', 'RESUME', 'NETWORKING'])
export const energyLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export const availableMinutesSchema = z.union([z.literal(5), z.literal(15), z.literal(30)])
export const frictionReasonSchema = z.enum([
  'TOO_BIG',
  'UNCLEAR',
  'LOW_ENERGY',
  'MISSING_MATERIAL',
  'OTHER',
])
export const questStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'REFRAMED'])

const uuidSchema = z.string().uuid()
const utcTimestampSchema = z.string().datetime({ offset: true })

export const sessionResponseSchema = z.object({
  expiresAt: utcTimestampSchema,
})

export const currentQuestSchema = z.object({
  id: uuidSchema,
  catalogKey: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  difficultyLevel: z.number().int().min(1).max(3),
})

export const recentAttemptSchema = z.object({
  id: uuidSchema,
  catalogKey: z.string().min(1),
  title: z.string().min(1),
  status: questStatusSchema,
  frictionReason: frictionReasonSchema.nullable(),
  transitionedAt: utcTimestampSchema,
})

export const journeySnapshotSchema = z.object({
  journeyId: uuidSchema,
  goalType: goalTypeSchema,
  energyLevel: energyLevelSchema,
  availableMinutes: availableMinutesSchema,
  version: z.number().int().nonnegative(),
  currentQuest: currentQuestSchema,
  progress: z.object({
    completedCount: z.number().int().nonnegative(),
    reframedCount: z.number().int().nonnegative(),
  }),
  recentAttempts: z.array(recentAttemptSchema).max(5),
})

export const transitionResultSchema = z.object({
  transition: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('COMPLETED'),
      previousAttemptId: uuidSchema,
      reason: z.null(),
    }),
    z.object({
      type: z.literal('REFRAMED'),
      previousAttemptId: uuidSchema,
      reason: frictionReasonSchema,
    }),
  ]),
  snapshot: journeySnapshotSchema,
})

export const apiErrorPayloadSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    fieldErrors: z.record(z.string(), z.string()).nullish(),
    snapshot: journeySnapshotSchema.nullish(),
  })
  .superRefine((payload, context) => {
    if (payload.code === 'STALE_JOURNEY' && payload.snapshot == null) {
      context.addIssue({
        code: 'custom',
        message: 'STALE_JOURNEY 오류에는 최신 snapshot이 필요합니다.',
        path: ['snapshot'],
      })
    }
  })

export const createJourneyInputSchema = z.object({
  goalType: goalTypeSchema,
  energyLevel: energyLevelSchema,
  availableMinutes: availableMinutesSchema,
})

export type GoalType = z.infer<typeof goalTypeSchema>
export type EnergyLevel = z.infer<typeof energyLevelSchema>
export type AvailableMinutes = z.infer<typeof availableMinutesSchema>
export type FrictionReason = z.infer<typeof frictionReasonSchema>
export type SessionResponse = z.infer<typeof sessionResponseSchema>
export type JourneySnapshot = z.infer<typeof journeySnapshotSchema>
export type TransitionResult = z.infer<typeof transitionResultSchema>
export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>
export type CreateJourneyInput = z.infer<typeof createJourneyInputSchema>
