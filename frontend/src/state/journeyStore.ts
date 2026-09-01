import {
  ApiContractError,
  QuestApiError,
  QuestNetworkError,
  type QuestApi,
} from '../api/client'
import type {
  ApiErrorPayload,
  CreateJourneyInput,
  FrictionReason,
  JourneySnapshot,
  TransitionResult,
} from '../api/contracts'

export type BootstrapState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'session-created' }
  | { status: 'journey-missing' }
  | { status: 'journey-restored' }
  | { status: 'session-expired'; message: string }
  | { status: 'network-error'; message: string }
  | { status: 'error'; message: string }

export type JourneyCommand =
  | { kind: 'create'; commandId: string; input: CreateJourneyInput }
  | { kind: 'complete'; commandId: string; questId: string; expectedVersion: number }
  | {
      kind: 'reframe'
      commandId: string
      questId: string
      expectedVersion: number
      reason: FrictionReason
    }

export type MutationState =
  | { status: 'idle' }
  | { status: 'pending'; command: JourneyCommand }
  | { status: 'retryable'; command: JourneyCommand; kind: 'network' | 'timeout'; message: string }
  | { status: 'success'; command: JourneyCommand; result: JourneySnapshot | TransitionResult }
  | { status: 'stale'; message: string }
  | { status: 'session-expired'; message: string }
  | { status: 'error'; code: string; message: string; fieldErrors: Record<string, string> }

export interface JourneyStoreState {
  bootstrap: BootstrapState
  snapshot: JourneySnapshot | null
  mutation: MutationState
}

type Listener = () => void
type CommandIdFactory = () => string

export class JourneyStore {
  private state: JourneyStoreState = {
    bootstrap: { status: 'idle' },
    snapshot: null,
    mutation: { status: 'idle' },
  }
  private readonly listeners = new Set<Listener>()
  private inFlight: Promise<JourneyStoreState> | null = null

  constructor(
    private readonly api: QuestApi,
    private readonly commandIdFactory: CommandIdFactory = () => crypto.randomUUID(),
  ) {}

  getState = (): JourneyStoreState => this.state

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async bootstrap(): Promise<JourneyStoreState> {
    this.setState({
      bootstrap: { status: 'loading' },
      snapshot: null,
      mutation: { status: 'idle' },
    })

    try {
      const session = await this.api.startSession()
      if (session.created) {
        this.setState({ ...this.state, bootstrap: { status: 'session-created' } })
        return this.state
      }

      const snapshot = await this.api.getJourney()
      this.setState({
        ...this.state,
        bootstrap: { status: 'journey-restored' },
        snapshot,
      })
    } catch (error) {
      if (error instanceof QuestApiError && error.status === 404) {
        this.setState({ ...this.state, bootstrap: { status: 'journey-missing' } })
      } else if (error instanceof QuestApiError && error.status === 401) {
        this.setState({
          ...this.state,
          bootstrap: {
            status: 'session-expired',
            message: '세션이 만료되어 새로 시작합니다.',
          },
          snapshot: null,
        })
      } else if (error instanceof QuestNetworkError) {
        this.setState({
          ...this.state,
          bootstrap: { status: 'network-error', message: error.message },
        })
      } else {
        this.setState({
          ...this.state,
          bootstrap: {
            status: 'error',
            message: error instanceof Error ? error.message : '앱을 시작하지 못했습니다.',
          },
        })
      }
    }

    return this.state
  }

  createJourney(input: CreateJourneyInput): Promise<JourneyStoreState> {
    if (this.inFlight) return this.inFlight
    if (this.state.mutation.status === 'retryable') return Promise.resolve(this.state)
    return this.beginCommand({ kind: 'create', commandId: this.commandIdFactory(), input })
  }

  completeCurrentQuest(): Promise<JourneyStoreState> {
    if (this.inFlight) return this.inFlight
    if (this.state.mutation.status === 'retryable') return Promise.resolve(this.state)
    const snapshot = this.requireSnapshot()
    return this.beginCommand({
      kind: 'complete',
      commandId: this.commandIdFactory(),
      questId: snapshot.currentQuest.id,
      expectedVersion: snapshot.version,
    })
  }

  reframeCurrentQuest(reason: FrictionReason): Promise<JourneyStoreState> {
    if (this.inFlight) return this.inFlight
    if (this.state.mutation.status === 'retryable') return Promise.resolve(this.state)
    const snapshot = this.requireSnapshot()
    return this.beginCommand({
      kind: 'reframe',
      commandId: this.commandIdFactory(),
      questId: snapshot.currentQuest.id,
      expectedVersion: snapshot.version,
      reason,
    })
  }

  retryMutation(): Promise<JourneyStoreState> {
    if (this.inFlight) return this.inFlight
    if (this.state.mutation.status !== 'retryable') return Promise.resolve(this.state)
    return this.runCommand(this.state.mutation.command)
  }

  private beginCommand(command: JourneyCommand): Promise<JourneyStoreState> {
    if (this.inFlight) return this.inFlight
    if (this.state.mutation.status === 'retryable') return Promise.resolve(this.state)
    return this.runCommand(command)
  }

  private runCommand(command: JourneyCommand): Promise<JourneyStoreState> {
    this.setState({ ...this.state, mutation: { status: 'pending', command } })
    const operation = this.execute(command)
      .then((result) => {
        const snapshot = 'snapshot' in result ? result.snapshot : result
        this.setState({
          ...this.state,
          snapshot,
          mutation: { status: 'success', command, result },
        })
        return this.state
      })
      .catch((error: unknown) => {
        this.handleMutationError(error, command)
        return this.state
      })
      .finally(() => {
        this.inFlight = null
      })

    this.inFlight = operation
    return operation
  }

  private execute(command: JourneyCommand): Promise<JourneySnapshot | TransitionResult> {
    switch (command.kind) {
      case 'create':
        return this.api.createJourney(command.input, command.commandId)
      case 'complete':
        return this.api.completeQuest(
          command.questId,
          command.commandId,
          command.expectedVersion,
        )
      case 'reframe':
        return this.api.reframeQuest(
          command.questId,
          command.reason,
          command.commandId,
          command.expectedVersion,
        )
    }
  }

  private handleMutationError(error: unknown, command: JourneyCommand): void {
    if (error instanceof QuestNetworkError) {
      this.setState({
        ...this.state,
        mutation: {
          status: 'retryable',
          command,
          kind: error.kind,
          message: error.message,
        },
      })
      return
    }

    if (error instanceof QuestApiError) {
      if (error.status === 409 && error.payload.code === 'STALE_JOURNEY' && error.payload.snapshot) {
        this.setState({
          ...this.state,
          snapshot: error.payload.snapshot,
          mutation: {
            status: 'stale',
            message: '다른 요청이 먼저 반영되어 최신 상태를 불러왔어요.',
          },
        })
        return
      }

      if (error.status === 401) {
        this.setState({
          ...this.state,
          snapshot: null,
          mutation: {
            status: 'session-expired',
            message: '세션이 만료되어 새로 시작합니다.',
          },
        })
        return
      }

      this.setApiError(error.payload)
      return
    }

    this.setState({
      ...this.state,
      mutation: {
        status: 'error',
        code: error instanceof ApiContractError ? 'INVALID_API_RESPONSE' : 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.',
        fieldErrors: {},
      },
    })
  }

  private setApiError(payload: ApiErrorPayload): void {
    this.setState({
      ...this.state,
      mutation: {
        status: 'error',
        code: payload.code,
        message: payload.message,
        fieldErrors: payload.fieldErrors ?? {},
      },
    })
  }

  private requireSnapshot(): JourneySnapshot {
    if (!this.state.snapshot) {
      throw new Error('현재 여정이 없어 변경 명령을 시작할 수 없습니다.')
    }
    return this.state.snapshot
  }

  private setState(state: JourneyStoreState): void {
    this.state = state
    this.listeners.forEach((listener) => listener())
  }
}
