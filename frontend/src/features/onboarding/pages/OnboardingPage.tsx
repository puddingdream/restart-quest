import { AppShell } from '../../../app/components/AppShell'
import { useAppNavigation } from '../../../app/routing'
import { useAuth } from '../../auth/AuthContext'
import { OnboardingForm } from '../components/OnboardingForm'
import { useOnboardingForm } from '../hooks/useOnboardingForm'

export function OnboardingPage() {
  const { user, markOnboardingCompleted } = useAuth()
  const { navigate } = useAppNavigation()
  const form = useOnboardingForm({
    onSaved() {
      markOnboardingCompleted()
      navigate('/today', { replace: true })
    },
  })

  const content = (
    <main className="page-container onboarding-page">
      <div className="page-heading">
        <p className="eyebrow">나에게 맞는 시작점</p>
        <h1>{user?.name}님의 오늘을 가볍게 설계해볼게요</h1>
        <p>
          정답은 없어요. 지금의 준비 상태를 알려주면 부담 없는 행동부터
          제안할게요.
        </p>
      </div>

      <section className="surface-card" aria-label="온보딩 정보 입력">
        <div className="section-marker" aria-hidden="true">
          01
        </div>
        {form.isLoading ? (
          <div className="loading-state" role="status">
            <span className="spinner spinner-dark" aria-hidden="true" />
            <p>저장된 시작점을 확인하고 있어요.</p>
          </div>
        ) : (
          <OnboardingForm
            values={form.values}
            errors={form.errors}
            isSubmitting={form.isSubmitting}
            apiError={form.apiError}
            updateField={form.updateField}
            onSubmit={form.submit}
          />
        )}
      </section>
    </main>
  )

  return user?.onboardingCompleted ? <AppShell>{content}</AppShell> : content
}
