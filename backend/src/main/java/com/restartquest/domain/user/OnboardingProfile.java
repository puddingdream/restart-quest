package com.restartquest.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "onboarding_profiles")
public class OnboardingProfile {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 80)
    private String desiredJob;

    @Column(length = 80)
    private String region;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DesiredWorkType desiredWorkType;

    @Column(nullable = false)
    private int careerGapMonths;

    @Column(nullable = false)
    private boolean hasResume;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewExperience interviewExperience;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    protected OnboardingProfile() {
    }

    private OnboardingProfile(UUID userId) {
        this.userId = userId;
    }

    public static OnboardingProfile create(UUID userId) {
        return new OnboardingProfile(userId);
    }

    public void update(
            String desiredJob,
            String region,
            DesiredWorkType desiredWorkType,
            int careerGapMonths,
            boolean hasResume,
            InterviewExperience interviewExperience
    ) {
        this.desiredJob = desiredJob;
        this.region = region;
        this.desiredWorkType = desiredWorkType;
        this.careerGapMonths = careerGapMonths;
        this.hasResume = hasResume;
        this.interviewExperience = interviewExperience;
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public UUID getUserId() {
        return userId;
    }

    public String getDesiredJob() {
        return desiredJob;
    }

    public String getRegion() {
        return region;
    }

    public DesiredWorkType getDesiredWorkType() {
        return desiredWorkType;
    }

    public int getCareerGapMonths() {
        return careerGapMonths;
    }

    public boolean isHasResume() {
        return hasResume;
    }

    public InterviewExperience getInterviewExperience() {
        return interviewExperience;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
