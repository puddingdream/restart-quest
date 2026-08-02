package com.restartquest.application.quest;

import com.restartquest.application.port.OnboardingProfileStore;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.user.User;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class GetTodayQuestsService {

    private final OnboardingProfileStore profileStore;
    private final QuestPlanStore questPlanStore;
    private final UserStore userStore;
    private final Clock questClock;

    public GetTodayQuestsService(
            OnboardingProfileStore profileStore,
            QuestPlanStore questPlanStore,
            UserStore userStore,
            Clock questClock
    ) {
        this.profileStore = profileStore;
        this.questPlanStore = questPlanStore;
        this.userStore = userStore;
        this.questClock = questClock;
    }

    public TodayQuestPlan get(UUID userId) {
        requireOnboarding(userId);
        LocalDate questDate = LocalDate.now(questClock);
        return questPlanStore.findByDateForUser(userId, questDate)
                .map(TodayQuestPlan::existing)
                .orElseGet(() -> TodayQuestPlan.empty(questDate));
    }

    private void requireOnboarding(UUID userId) {
        User user = userStore.findById(userId)
                .orElseThrow(DailyQuestException::onboardingRequired);
        if (!user.isOnboardingCompleted() || profileStore.findByUserId(userId).isEmpty()) {
            throw DailyQuestException.onboardingRequired();
        }
    }
}
