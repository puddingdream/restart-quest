package com.restartquest.application.port;

import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.QuestJourney;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface QuestPlanStore {

    DailyQuestPlan saveForUser(UUID userId, DailyQuestPlan plan);

    Optional<DailyQuestPlan> findByDateForUser(UUID userId, LocalDate questDate);

    Optional<QuestJourney> findJourneyForUser(UUID userId, UUID journeyId);

    Optional<QuestJourney> findJourneyByCurrentQuestForUser(UUID userId, UUID questId);

    Optional<QuestJourney> findJourneySnapshotByQuestForUser(UUID userId, UUID questId);

    Optional<QuestJourney> findJourneyByQuestForUser(UUID userId, UUID questId);

    QuestJourney saveJourneyForUser(UUID userId, QuestJourney journey);
}
