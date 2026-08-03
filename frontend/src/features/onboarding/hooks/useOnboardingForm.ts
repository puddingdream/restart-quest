import { useEffect, useState } from 'react'
import {
  ApiError,
  getApiErrorMessage,
  isSessionExpired,
} from '../../../shared/api/ApiError'
import { onboardingApi } from '../api/onboardingApi'
import { useAuth } from '../../auth/AuthContext'
import type { OnboardingFormValues } from '../types'
import {
  toOnboardingRequest,
  validateOnboarding,
  type OnboardingErrors,
} from '../validation'

const INITIAL_VALUES: OnboardingFormValues = {
  desiredJob: '',
  region: '',
  desiredWorkType: 'ANY',
  careerGapMonths: 0,
  hasResume: false,
  interviewExperience: 'NONE',
}

interface UseOnboardingFormOptions {
  onSaved: () => void
}

export function useOnboardingForm({ onSaved }: UseOnboardingFormOptions) {
  const [values, setValues] = useState<OnboardingFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<OnboardingErrors>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isLoadBlocked, setIsLoadBlocked] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const { expireSession } = useAuth()

  useEffect(() => {
    let active = true
    onboardingApi
      .getMe()
      .then(({ profile }) => {
        if (!active) return
        setValues({
          desiredJob: profile.desiredJob,
          region: profile.region ?? '',
          desiredWorkType: profile.desiredWorkType,
          careerGapMonths: profile.careerGapMonths,
          hasResume: profile.hasResume,
          interviewExperience: profile.interviewExperience,
        })
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof ApiError && error.status === 404)) return
        if (isSessionExpired(error)) {
          expireSession()
          return
        }
        setApiError(getApiErrorMessage(error))
        setIsLoadBlocked(true)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [expireSession, loadAttempt])

  function updateField<K extends keyof OnboardingFormValues>(
    field: K,
    value: OnboardingFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setApiError(null)
  }

  async function submit(): Promise<void> {
    if (isLoadBlocked) return
    const nextErrors = validateOnboarding(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setApiError(null)
    try {
      await onboardingApi.upsert(toOnboardingRequest(values))
      onSaved()
    } catch (error) {
      if (isSessionExpired(error)) {
        expireSession()
        return
      }
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(
            error.fieldErrors.map(({ field, reason }) => [field, reason]),
          ),
        }))
      }
      setApiError(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    values,
    errors,
    isLoading,
    isSubmitting,
    isLoadBlocked,
    apiError,
    retryLoad() {
      setApiError(null)
      setIsLoadBlocked(false)
      setIsLoading(true)
      setLoadAttempt((current) => current + 1)
    },
    updateField,
    submit,
  }
}
