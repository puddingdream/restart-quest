import { useEffect, useState } from 'react'
import { ApiError, getApiErrorMessage } from '../../../shared/api/ApiError'
import { onboardingApi } from '../api/onboardingApi'
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
        setApiError(getApiErrorMessage(error))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function updateField<K extends keyof OnboardingFormValues>(
    field: K,
    value: OnboardingFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setApiError(null)
  }

  async function submit(): Promise<void> {
    const nextErrors = validateOnboarding(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setApiError(null)
    try {
      await onboardingApi.upsert(toOnboardingRequest(values))
      onSaved()
    } catch (error) {
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
    apiError,
    updateField,
    submit,
  }
}
