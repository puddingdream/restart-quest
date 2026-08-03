import { AppShell } from '../../../app/components/AppShell'
import { useAuth } from '../../auth/AuthContext'
import { TodayQuestContent } from '../components/TodayQuestContent'
import { useQuestOutcomes } from '../hooks/useQuestOutcomes'
import { useTodayQuests } from '../hooks/useTodayQuests'
import '../quests.css'
import '../../../styles/quest-outcomes.css'

export function TodayPage() {
  const { user } = useAuth()
  const todayQuests = useTodayQuests()
  const questOutcomes = useQuestOutcomes({
    onJourneyUpdated: todayQuests.replaceJourney,
  })

  return (
    <AppShell>
      <main className="page-container route-placeholder">
        <section className="route-intro">
          <p className="eyebrow">Today · 작은 행동부터</p>
          <h1>{user?.name}님, 오늘의 퀘스트를 시작해볼까요?</h1>
          <p>
            준비 상태가 저장되었어요. 오늘 가능한 에너지를 고르면 세 개의 작은
            구직 행동을 만날 수 있어요.
          </p>
        </section>
        <TodayQuestContent
          plan={todayQuests.plan}
          selectedEnergy={todayQuests.selectedEnergy}
          validationError={todayQuests.validationError}
          error={todayQuests.error}
          isLoading={todayQuests.isLoading}
          isGenerating={todayQuests.isGenerating}
          outcomeAnnouncement={questOutcomes.announcement}
          onEnergyChange={todayQuests.selectEnergy}
          onGenerate={() => void todayQuests.generate()}
          onRetry={todayQuests.retry}
          isQuestPending={questOutcomes.isPending}
          getOutcomeError={questOutcomes.getError}
          onComplete={questOutcomes.complete}
          onRedesign={questOutcomes.redesign}
          onRefresh={() => void todayQuests.refresh()}
          onClearOutcomeError={questOutcomes.clearError}
        />
      </main>
    </AppShell>
  )
}
