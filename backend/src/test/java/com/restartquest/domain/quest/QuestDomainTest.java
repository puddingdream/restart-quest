package com.restartquest.domain.quest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class QuestDomainTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Test
    void dailyPlanStartsWithExactlyThreeIndependentJourneys() {
        DailyQuestPlan plan = createPlan();

        assertThat(plan.getJourneys()).hasSize(3);
        assertThat(plan.getJourneys())
                .extracting(QuestJourney::getInitialSlot)
                .containsExactly(1, 2, 3);
        assertThat(plan.getJourneys()).allSatisfy(journey -> {
            assertThat(journey.getStatus()).isEqualTo(QuestJourneyStatus.ACTIVE);
            assertThat(journey.getQuests()).hasSize(1);
            assertThat(journey.getRootQuestId()).isEqualTo(journey.getCurrentQuestId());
            assertThat(journey.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.TODO);
        });
    }

    @Test
    void dailyPlanRejectsAnyInitialQuestCountOtherThanThree() {
        assertThatThrownBy(() -> DailyQuestPlan.create(
                USER_ID,
                LocalDate.of(2026, 8, 1),
                EnergyLevel.LOW,
                List.of(initialSeed("첫 번째"), initialSeed("두 번째"))
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("정확히 3개");

        assertThatThrownBy(() -> DailyQuestPlan.create(
                USER_ID,
                LocalDate.of(2026, 8, 1),
                EnergyLevel.LOW,
                List.of(
                        initialSeed("첫 번째"),
                        initialSeed("두 번째"),
                        initialSeed("세 번째"),
                        initialSeed("네 번째")
                )
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("정확히 3개");
    }

    @Test
    void onlyCurrentTodoQuestCanBeCompleted() {
        QuestJourney journey = createPlan().getJourneys().get(0);
        UUID currentQuestId = journey.getCurrentQuestId();

        journey.complete(currentQuestId);

        assertThat(journey.getStatus()).isEqualTo(QuestJourneyStatus.COMPLETED);
        assertThat(journey.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.DONE);
        assertThat(journey.getCurrentQuest().getCompletedAt()).isNotNull();
        assertThatThrownBy(() -> journey.complete(currentQuestId))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> journey.redesign(
                currentQuestId,
                replacementSeed("더 작은 행동", 5),
                QuestRedesignReasonCode.LOW_ENERGY,
                null
        )).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void redesignConnectsOriginalAndReplacementAndPreservesReason() {
        QuestJourney journey = createPlan().getJourneys().get(0);
        Quest original = journey.getCurrentQuest();

        QuestRedesign redesign = journey.redesign(
                original.getId(),
                replacementSeed("채용 공고 하나 제목만 적기", 8),
                QuestRedesignReasonCode.START_POINT_UNCLEAR,
                "어디서 시작할지 정하기 어려웠어요."
        );

        Quest replacement = journey.getCurrentQuest();
        assertThat(original.getStatus()).isEqualTo(QuestStatus.REDESIGNED);
        assertThat(replacement.getStatus()).isEqualTo(QuestStatus.TODO);
        assertThat(replacement.getParentQuestId()).isEqualTo(original.getId());
        assertThat(replacement.getRevision()).isEqualTo(1);
        assertThat(replacement.getCategory()).isEqualTo(original.getCategory());
        assertThat(redesign.getJourneyId()).isEqualTo(journey.getId());
        assertThat(redesign.getOriginalQuestId()).isEqualTo(original.getId());
        assertThat(redesign.getReplacementQuestId()).isEqualTo(replacement.getId());
        assertThat(redesign.getReasonCode()).isEqualTo(QuestRedesignReasonCode.START_POINT_UNCLEAR);
        assertThat(redesign.getReasonNote()).isEqualTo("어디서 시작할지 정하기 어려웠어요.");
        assertThat(journey.getQuests())
                .filteredOn(quest -> quest.getStatus() == QuestStatus.TODO)
                .hasSize(1);
    }

    @Test
    void replacementMustKeepCategoryAndNotTakeLongerThanOriginal() {
        QuestJourney journey = createPlan().getJourneys().get(0);
        UUID currentQuestId = journey.getCurrentQuestId();
        QuestSeed wrongCategory = new QuestSeed(
                "다른 카테고리",
                "설명",
                "완료 기준",
                List.of("한 단계"),
                QuestCategory.INTERVIEW,
                QuestDifficulty.EASY,
                5,
                true
        );

        assertThatThrownBy(() -> journey.redesign(
                currentQuestId,
                wrongCategory,
                QuestRedesignReasonCode.OTHER,
                null
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("같은 category");

        QuestSeed tooLong = replacementSeed("너무 긴 행동", 15);
        assertThatThrownBy(() -> journey.redesign(
                currentQuestId,
                tooLong,
                QuestRedesignReasonCode.TIME_SHORTAGE,
                null
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("오래 걸릴 수 없습니다");
        assertThat(journey.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.TODO);
        assertThat(journey.getQuests()).hasSize(1);
    }

    private static DailyQuestPlan createPlan() {
        return DailyQuestPlan.create(
                USER_ID,
                LocalDate.of(2026, 8, 1),
                EnergyLevel.MEDIUM,
                List.of(
                        initialSeed("채용 공고 살펴보기"),
                        initialSeed("이력서 한 줄 다듬기"),
                        initialSeed("면접 답변 키워드 적기")
                )
        );
    }

    private static QuestSeed initialSeed(String title) {
        return new QuestSeed(
                title,
                "오늘 할 작은 구직 행동입니다.",
                "결과를 한 줄 기록합니다.",
                List.of("자료를 연다", "한 줄 기록한다"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                10,
                true
        );
    }

    private static QuestSeed replacementSeed(String title, int estimatedMinutes) {
        return new QuestSeed(
                title,
                "원래 목적을 유지한 더 작은 행동입니다.",
                "한 줄을 남깁니다.",
                List.of("한 줄 적기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                estimatedMinutes,
                true
        );
    }
}
