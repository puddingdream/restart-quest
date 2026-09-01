import { z, type ZodType } from 'zod'
import {
  apiErrorPayloadSchema,
  createJourneyInputSchema,
  frictionReasonSchema,
  journeySnapshotSchema,
  sessionResponseSchema,
  transitionResultSchema,
  type ApiErrorPayload,
  type CreateJourneyInput,
  type FrictionReason,
  type JourneySnapshot,
  type TransitionResult,
} from './contracts'

const uuidSchema = z.string().uuid()
const commandIdSchema = uuidSchema
const versionSchema = z.number().int().nonnegative()

export interface SessionStartResult {
  created: boolean
  expiresAt: string
}

export interface QuestApi {
  startSession(): Promise<SessionStartResult>
  getJourney(): Promise<JourneySnapshot>
  createJourney(input: CreateJourneyInput, commandId: string): Promise<JourneySnapshot>
  completeQuest(
    questId: string,
    commandId: string,
    expectedVersion: number,
  ): Promise<TransitionResult>
  reframeQuest(
    questId: string,
    reason: FrictionReason,
    commandId: string,
    expectedVersion: number,
  ): Promise<TransitionResult>
}

export class QuestApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload,
  ) {
    super(payload.message)
    this.name = 'QuestApiError'
  }
}

export class ApiContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiContractError'
  }
}

export class QuestNetworkError extends Error {
  constructor(
    public readonly kind: 'network' | 'timeout',
    options?: ErrorOptions,
  ) {
    super(
      kind === 'timeout'
        ? '요청 시간이 초과되었습니다.'
        : '서버에 연결하지 못했습니다.',
      options,
    )
    this.name = 'QuestNetworkError'
  }
}

export interface QuestApiClientOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

interface RequestOptions<T> {
  method: 'GET' | 'POST'
  path: string
  successStatuses: readonly number[]
  schema: ZodType<T>
  body?: unknown
}

export class QuestApiClient implements QuestApi {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: QuestApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? ''
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 10_000
  }

  async startSession(): Promise<SessionStartResult> {
    const { data, status } = await this.request({
      method: 'POST',
      path: '/api/v1/session',
      successStatuses: [200, 201],
      schema: sessionResponseSchema,
    })

    return { created: status === 201, expiresAt: data.expiresAt }
  }

  async getJourney(): Promise<JourneySnapshot> {
    return (
      await this.request({
        method: 'GET',
        path: '/api/v1/journey',
        successStatuses: [200],
        schema: journeySnapshotSchema,
      })
    ).data
  }

  async createJourney(input: CreateJourneyInput, commandId: string): Promise<JourneySnapshot> {
    const body = { ...createJourneyInputSchema.parse(input), commandId: commandIdSchema.parse(commandId) }
    return (
      await this.request({
        method: 'POST',
        path: '/api/v1/journey',
        successStatuses: [201],
        schema: journeySnapshotSchema,
        body,
      })
    ).data
  }

  async completeQuest(
    questId: string,
    commandId: string,
    expectedVersion: number,
  ): Promise<TransitionResult> {
    const validQuestId = uuidSchema.parse(questId)
    const body = {
      commandId: commandIdSchema.parse(commandId),
      expectedVersion: versionSchema.parse(expectedVersion),
    }
    return (
      await this.request({
        method: 'POST',
        path: `/api/v1/quests/${encodeURIComponent(validQuestId)}/complete`,
        successStatuses: [200],
        schema: transitionResultSchema,
        body,
      })
    ).data
  }

  async reframeQuest(
    questId: string,
    reason: FrictionReason,
    commandId: string,
    expectedVersion: number,
  ): Promise<TransitionResult> {
    const validQuestId = uuidSchema.parse(questId)
    const body = {
      reason: frictionReasonSchema.parse(reason),
      commandId: commandIdSchema.parse(commandId),
      expectedVersion: versionSchema.parse(expectedVersion),
    }
    return (
      await this.request({
        method: 'POST',
        path: `/api/v1/quests/${encodeURIComponent(validQuestId)}/reframe`,
        successStatuses: [200],
        schema: transitionResultSchema,
        body,
      })
    ).data
  }

  private async request<T>(options: RequestOptions<T>): Promise<{ data: T; status: number }> {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response

    try {
      response = await this.fetchImpl(`${this.baseUrl}${options.path}`, {
        method: options.method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
    } catch (cause) {
      throw new QuestNetworkError(controller.signal.aborted ? 'timeout' : 'network', {
        cause,
      })
    } finally {
      globalThis.clearTimeout(timeout)
    }

    const payload = await this.readJson(response)

    if (!response.ok) {
      const parsedError = apiErrorPayloadSchema.safeParse(payload)
      if (!parsedError.success) {
        throw new ApiContractError(`HTTP ${response.status} 오류 payload가 API 계약과 다릅니다.`)
      }
      throw new QuestApiError(response.status, parsedError.data)
    }

    if (!options.successStatuses.includes(response.status)) {
      throw new ApiContractError(`예상하지 않은 성공 상태 코드입니다: ${response.status}`)
    }

    const parsed = options.schema.safeParse(payload)
    if (!parsed.success) {
      throw new ApiContractError(`HTTP ${response.status} 응답이 API 계약과 다릅니다.`)
    }

    return { data: parsed.data, status: response.status }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch (cause) {
      throw new ApiContractError(
        cause instanceof Error
          ? `HTTP ${response.status} 응답을 JSON으로 해석할 수 없습니다: ${cause.name}`
          : `HTTP ${response.status} 응답을 JSON으로 해석할 수 없습니다.`,
      )
    }
  }
}
