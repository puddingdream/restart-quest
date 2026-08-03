package com.restartquest.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestSeed;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

@DataJpaTest
@Import(QuestPlanStoreAdapter.class)
class QuestCompletionStoreTest {

    @Autowired
    private QuestPlanStore store;

    @Test
    void findsOwnedCurrentAndHistoricalQuestWithoutLeakingAnotherUsersQuest() {
        UUID ownerId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        QuestJourney journey = store.saveForUser(ownerId, createPlan(ownerId))
                .getJourneys()
                .get(0);
        UUID originalQuestId = journey.getCurrentQuestId();

        assertThat(store.findJourneyByQuestForUser(ownerId, originalQuestId)).contains(journey);
        assertThat(store.findJourneyByQuestForUser(otherUserId, originalQuestId)).isEmpty();

        journey.redesign(
                originalQuestId,
                replacementSeed(),
                QuestRedesignReasonCode.TASK_TOO_LARGE,
                null
        );
        store.saveJourneyForUser(ownerId, journey);

        assertThat(store.findJourneyByQuestForUser(ownerId, originalQuestId)).isPresent();
    }

    private static DailyQuestPlan createPlan(UUID userId) {
        return DailyQuestPlan.create(
                userId,
                LocalDate.of(2026, 8, 3),
                EnergyLevel.MEDIUM,
                List.of(initialSeed("공고 제목 보기"), initialSeed("이력서 열기"), initialSeed("답변 키워드 보기"))
        );
    }

    private static QuestSeed initialSeed(String title) {
        return new QuestSeed(
                title,
                "오늘 할 작은 행동입니다.",
                "한 줄을 기록합니다.",
                List.of("자료 열기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                10,
                true
        );
    }

    private static QuestSeed replacementSeed() {
        return new QuestSeed(
                "공고 사이트만 열기",
                "원래 목적을 유지한 더 작은 행동입니다.",
                "사이트를 열어 둡니다.",
                List.of("사이트 열기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                5,
                true
        );
    }
}
