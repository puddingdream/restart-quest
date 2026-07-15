import { FormEvent, useMemo, useState } from "react";
import { EnergyLevel, OnboardingProfile } from "../types";

type OnboardingFormState = {
  region: string;
  desiredJob: string;
  desiredWorkType: string;
  careerGapMonths: string;
  hasResume: boolean;
  hasInterviewExperience: boolean;
  interests: string;
  energyLevel: EnergyLevel;
};

const defaultForm: OnboardingFormState = {
  region: "서울",
  desiredJob: "백엔드 개발자",
  desiredWorkType: "정규직",
  careerGapMonths: "8",
  hasResume: true,
  hasInterviewExperience: false,
  interests: "Java, Spring, 웹 백엔드",
  energyLevel: "LOW",
};

export function useOnboardingForm(
  savedProfile: OnboardingProfile | null,
  onSubmit: (profile: OnboardingProfile) => void,
) {
  const [form, setForm] = useState<OnboardingFormState>(
    savedProfile ? toFormState(savedProfile) : defaultForm,
  );

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  function updateField<K extends keyof OnboardingFormState>(
    key: K,
    value: OnboardingFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit({
      region: form.region.trim(),
      desiredJob: form.desiredJob.trim(),
      desiredWorkType: form.desiredWorkType,
      careerGapMonths: Number(form.careerGapMonths),
      hasResume: form.hasResume,
      hasInterviewExperience: form.hasInterviewExperience,
      interests: form.interests.trim(),
      energyLevel: form.energyLevel,
    });
  }

  return {
    errors,
    form,
    handleSubmit,
    isValid,
    updateField,
  };
}

function validate(form: OnboardingFormState) {
  const errors: Partial<Record<keyof OnboardingFormState, string>> = {};
  const gapMonths = Number(form.careerGapMonths);

  if (form.region.trim().length < 2) {
    errors.region = "지역을 2글자 이상 입력해주세요.";
  }

  if (form.desiredJob.trim().length < 2) {
    errors.desiredJob = "희망 직무를 입력해주세요.";
  }

  if (!Number.isFinite(gapMonths) || gapMonths < 0 || gapMonths > 120) {
    errors.careerGapMonths = "공백 기간은 0개월부터 120개월 사이로 입력해주세요.";
  }

  if (form.interests.trim().length < 2) {
    errors.interests = "관심 분야나 기술을 하나 이상 적어주세요.";
  }

  return errors;
}

function toFormState(profile: OnboardingProfile): OnboardingFormState {
  return {
    ...profile,
    careerGapMonths: String(profile.careerGapMonths),
  };
}
