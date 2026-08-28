package com.restartquest.application.quest;

import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestPersonalization;
import com.restartquest.application.port.OnboardingProfileStore;
import com.restartquest.application.port.QuestAiClient;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.user.OnboardingProfile;
import com.restartquest.domain.user.User;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class GenerateDailyQuestsService {

    private final OnboardingProfileStore profileStore;
    private final QuestPlanStore questPlanStore;
    private final QuestAiClient questAiClient;
    private final UserStore userStore;
    private final Clock questClock;

    public GenerateDailyQuestsService(
            OnboardingProfileStore profileStore,
            QuestPlanStore questPlanStore,
            QuestAiClient questAiClient,
            UserStore userStore,
            Clock questClock
    ) {
        this.profileStore = profileStore;
        this.questPlanStore = questPlanStore;
        this.questAiClient = questAiClient;
        this.userStore = userStore;
        this.questClock = questClock;
    }

    public TodayQuestPlan generate(UUID userId, EnergyLevel energyLevel) {
        requireOnboarding(userId);
        OnboardingProfile profile = profileStore.findByUserId(userId)
                .orElseThrow(DailyQuestException::onboardingRequired);
        LocalDate questDate = LocalDate.now(questClock);

        TodayQuestPlan existing = findExisting(userId, questDate);
        if (existing != null) {
            return existing;
        }

        GeneratedQuestBatch generatedBatch = questAiClient.generateDailyQuests(
                new QuestGenerationRequest(personalization(profile, energyLevel))
        );
        DailyQuestPlan candidate = DailyQuestPlan.create(
                userId,
                questDate,
                energyLevel,
                generatedBatch.toAiGeneratedSeeds()
        );

        try {
            return TodayQuestPlan.generated(questPlanStore.saveForUser(userId, candidate));
        } catch (DataIntegrityViolationException exception) {
            TodayQuestPlan concurrentWinner = findExisting(userId, questDate);
            if (concurrentWinner != null) {
                return concurrentWinner;
            }
            throw exception;
        }
    }

    private TodayQuestPlan findExisting(UUID userId, LocalDate questDate) {
        return questPlanStore.findByDateForUser(userId, questDate)
                .map(TodayQuestPlan::existing)
                .orElse(null);
    }

    private void requireOnboarding(UUID userId) {
        User user = userStore.findById(userId)
                .orElseThrow(DailyQuestException::onboardingRequired);
        if (!user.isOnboardingCompleted()) {
            throw DailyQuestException.onboardingRequired();
        }
    }

    private static QuestPersonalization personalization(
            OnboardingProfile profile,
            EnergyLevel energyLevel
    ) {
        return new QuestPersonalization(
                profile.getDesiredJob(),
                profile.getRegion(),
                profile.getDesiredWorkType(),
                profile.getCareerGapMonths(),
                profile.isHasResume(),
                profile.getInterviewExperience(),
                energyLevel
        );
    }
}
