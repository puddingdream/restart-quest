package com.restartquest.application.quest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.restartquest.application.error.AppException;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestSeed;
import com.restartquest.domain.quest.QuestStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class CompleteQuestServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private QuestPlanStore questPlanStore;

    private CompleteQuestService service;

    @BeforeEach
    void setUp() {
        service = new CompleteQuestService(questPlanStore);
    }

    @Test
    void completesCurrentTodoQuestAndJourney() {
        QuestJourney journey = createJourney();
        UUID questId = journey.getCurrentQuestId();
        when(questPlanStore.findJourneyByQuestForUser(USER_ID, questId)).thenReturn(Optional.of(journey));
        when(questPlanStore.saveJourneyForUser(USER_ID, journey)).thenReturn(journey);

        QuestJourney result = service.complete(USER_ID, questId);

        assertThat(result.getStatus()).isEqualTo(QuestJourneyStatus.COMPLETED);
        assertThat(result.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.DONE);
        assertThat(result.getCurrentQuest().getCompletedAt()).isNotNull();
    }

    @Test
    void hidesMissingAndOtherUsersQuestBehindTheSameNotFoundError() {
        UUID unknownQuestId = UUID.randomUUID();
        when(questPlanStore.findJourneyByQuestForUser(USER_ID, unknownQuestId)).thenReturn(Optional.empty());

        assertAppError(
                () -> service.complete(USER_ID, unknownQuestId),
                HttpStatus.NOT_FOUND,
                "QUEST_NOT_FOUND"
        );
        verify(questPlanStore, never()).saveJourneyForUser(same(USER_ID), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsDuplicateCompletionAsAlreadyResolved() {
        QuestJourney journey = createJourney();
        UUID questId = journey.getCurrentQuestId();
        journey.complete(questId);
        when(questPlanStore.findJourneyByQuestForUser(USER_ID, questId)).thenReturn(Optional.of(journey));

        assertAppError(
                () -> service.complete(USER_ID, questId),
                HttpStatus.CONFLICT,
                "QUEST_ALREADY_RESOLVED"
        );
    }

    @Test
    void rejectsRedesignedQuestAsAlreadyResolved() {
        QuestJourney journey = createJourney();
        UUID originalQuestId = journey.getCurrentQuestId();
        journey.redesign(
                originalQuestId,
                replacementSeed(),
                QuestRedesignReasonCode.LOW_ENERGY,
                null
        );
        when(questPlanStore.findJourneyByQuestForUser(USER_ID, originalQuestId))
                .thenReturn(Optional.of(journey));

        assertAppError(
                () -> service.complete(USER_ID, originalQuestId),
                HttpStatus.CONFLICT,
                "QUEST_ALREADY_RESOLVED"
        );
    }

    @Test
    void mapsOptimisticLockRaceToAlreadyResolved() {
        QuestJourney journey = createJourney();
        UUID questId = journey.getCurrentQuestId();
        when(questPlanStore.findJourneyByQuestForUser(USER_ID, questId)).thenReturn(Optional.of(journey));
        when(questPlanStore.saveJourneyForUser(USER_ID, journey))
                .thenThrow(new ObjectOptimisticLockingFailureException(QuestJourney.class, journey.getId()));

        assertAppError(
                () -> service.complete(USER_ID, questId),
                HttpStatus.CONFLICT,
                "QUEST_ALREADY_RESOLVED"
        );
    }

    private static void assertAppError(Runnable action, HttpStatus status, String code) {
        assertThatThrownBy(action::run)
                .isInstanceOf(AppException.class)
                .satisfies(exception -> {
                    AppException appException = (AppException) exception;
                    assertThat(appException.getStatus()).isEqualTo(status);
                    assertThat(appException.getCode()).isEqualTo(code);
                });
    }

    private static QuestJourney createJourney() {
        return DailyQuestPlan.create(
                USER_ID,
                LocalDate.of(2026, 8, 3),
                EnergyLevel.MEDIUM,
                List.of(initialSeed("공고 제목 보기"), initialSeed("이력서 열기"), initialSeed("답변 키워드 보기"))
        ).getJourneys().get(0);
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
