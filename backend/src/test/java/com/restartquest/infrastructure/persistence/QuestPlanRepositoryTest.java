package com.restartquest.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import com.restartquest.domain.quest.QuestOwnershipException;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestSeed;
import com.restartquest.domain.quest.QuestStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@DataJpaTest
@Import(QuestPlanStoreAdapter.class)
class QuestPlanRepositoryTest {

    private static final LocalDate QUEST_DATE = LocalDate.of(2026, 8, 1);

    @Autowired
    private QuestPlanStore store;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void userAndQuestDateHaveDatabaseUniqueConstraint() {
        UUID userId = UUID.randomUUID();
        store.saveForUser(userId, createPlan(userId, QUEST_DATE));

        assertThatThrownBy(() -> store.saveForUser(userId, createPlan(userId, QUEST_DATE)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsPlanMetadataThatDoesNotDeclareThreeJourneys() {
        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into daily_quest_plans
                    (id, user_id, quest_date, energy_level, initial_journey_count, created_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                UUID.randomUUID(),
                QUEST_DATE,
                EnergyLevel.LOW.name(),
                2,
                OffsetDateTime.now(ZoneOffset.UTC)
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsFourthInitialJourney() {
        UUID userId = UUID.randomUUID();
        DailyQuestPlan plan = store.saveForUser(userId, createPlan(userId, QUEST_DATE));
        Integer journeyCount = jdbcTemplate.queryForObject(
                "select count(*) from quest_journeys where daily_quest_plan_id = ?",
                Integer.class,
                plan.getId()
        );
        assertThat(journeyCount).isEqualTo(3);

        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into quest_journeys
                    (id, daily_quest_plan_id, initial_slot, root_quest_id, current_quest_id, status, version)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                plan.getId(),
                4,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "ACTIVE",
                0
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsRedesignThatConnectsQuestsFromDifferentJourneys() {
        UUID userId = UUID.randomUUID();
        DailyQuestPlan plan = store.saveForUser(userId, createPlan(userId, QUEST_DATE));
        QuestJourney originalJourney = plan.getJourneys().get(0);
        QuestJourney replacementJourney = plan.getJourneys().get(1);

        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into quest_redesigns
                    (id, journey_id, original_quest_id, original_journey_id,
                     replacement_quest_id, replacement_journey_id,
                     reason_code, reason_note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                originalJourney.getId(),
                originalJourney.getCurrentQuestId(),
                originalJourney.getId(),
                replacementJourney.getCurrentQuestId(),
                replacementJourney.getId(),
                QuestRedesignReasonCode.OTHER.name(),
                null,
                OffsetDateTime.now(ZoneOffset.UTC)
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseAllowsAtMostOneTodoQuestInJourney() {
        UUID userId = UUID.randomUUID();
        QuestJourney journey = store.saveForUser(userId, createPlan(userId, QUEST_DATE))
                .getJourneys()
                .get(0);

        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into quests
                    (id, journey_id, parent_quest_id, revision, title, description,
                     completion_criteria, category, difficulty, estimated_minutes,
                     status, current_marker, generated_by_ai, created_at, version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                journey.getId(),
                journey.getCurrentQuestId(),
                1,
                "중복 현재 퀘스트",
                "설명",
                "완료 기준",
                "JOB_SEARCH",
                "EASY",
                5,
                "TODO",
                1,
                true,
                OffsetDateTime.now(ZoneOffset.UTC),
                0
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void repositoryQueriesAndSavesOnlyInsideCurrentUserScope() {
        UUID ownerId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        DailyQuestPlan ownerPlan = store.saveForUser(ownerId, createPlan(ownerId, QUEST_DATE));
        QuestJourney ownerJourney = ownerPlan.getJourneys().get(0);

        assertThat(store.findByDateForUser(ownerId, QUEST_DATE)).contains(ownerPlan);
        assertThat(store.findByDateForUser(otherUserId, QUEST_DATE)).isEmpty();
        assertThat(store.findJourneyForUser(ownerId, ownerJourney.getId())).isPresent();
        assertThat(store.findJourneyForUser(otherUserId, ownerJourney.getId())).isEmpty();
        assertThat(store.findJourneyByCurrentQuestForUser(ownerId, ownerJourney.getCurrentQuestId())).isPresent();
        assertThat(store.findJourneyByCurrentQuestForUser(otherUserId, ownerJourney.getCurrentQuestId())).isEmpty();
        assertThatThrownBy(() -> store.saveForUser(otherUserId, ownerPlan))
                .isInstanceOf(QuestOwnershipException.class);
        assertThatThrownBy(() -> store.saveJourneyForUser(otherUserId, ownerJourney))
                .isInstanceOf(QuestOwnershipException.class);
    }

    @Test
    void redesignRoundTripPreservesLinkReasonAndOptionalNote() {
        UUID userId = UUID.randomUUID();
        DailyQuestPlan plan = store.saveForUser(userId, createPlan(userId, QUEST_DATE));
        QuestJourney journey = plan.getJourneys().get(0);
        UUID originalQuestId = journey.getCurrentQuestId();
        journey.redesign(
                originalQuestId,
                replacementSeed(),
                QuestRedesignReasonCode.MATERIALS_MISSING,
                "자료 위치부터 확인할게요."
        );
        store.saveJourneyForUser(userId, journey);

        QuestJourney reloaded = store.findJourneyForUser(userId, journey.getId()).orElseThrow();
        Integer currentMarkerCount = jdbcTemplate.queryForObject(
                "select count(*) from quests where journey_id = ? and current_marker = 1",
                Integer.class,
                journey.getId()
        );
        assertThat(currentMarkerCount).isEqualTo(1);
        assertThat(reloaded.getRedesigns()).singleElement().satisfies(redesign -> {
            assertThat(redesign.getJourneyId()).isEqualTo(reloaded.getId());
            assertThat(redesign.getOriginalQuestId()).isEqualTo(originalQuestId);
            assertThat(redesign.getReplacementQuestId()).isEqualTo(reloaded.getCurrentQuestId());
            assertThat(redesign.getReasonCode()).isEqualTo(QuestRedesignReasonCode.MATERIALS_MISSING);
            assertThat(redesign.getReasonNote()).isEqualTo("자료 위치부터 확인할게요.");
        });
    }

    @Test
    void completionRoundTripLeavesNoTodoAndCannotBeReopened() {
        UUID userId = UUID.randomUUID();
        DailyQuestPlan plan = store.saveForUser(userId, createPlan(userId, QUEST_DATE));
        QuestJourney journey = plan.getJourneys().get(0);
        UUID completedQuestId = journey.getCurrentQuestId();

        journey.complete(completedQuestId);
        store.saveJourneyForUser(userId, journey);

        QuestJourney reloaded = store.findJourneyForUser(userId, journey.getId()).orElseThrow();
        Integer currentMarkerCount = jdbcTemplate.queryForObject(
                "select count(*) from quests where journey_id = ? and current_marker = 1",
                Integer.class,
                journey.getId()
        );
        assertThat(reloaded.getStatus()).isEqualTo(QuestJourneyStatus.COMPLETED);
        assertThat(reloaded.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.DONE);
        assertThat(currentMarkerCount).isZero();
        assertThatThrownBy(() -> reloaded.complete(completedQuestId))
                .isInstanceOf(IllegalStateException.class);
    }

    static DailyQuestPlan createPlan(UUID userId, LocalDate questDate) {
        return DailyQuestPlan.create(
                userId,
                questDate,
                EnergyLevel.MEDIUM,
                List.of(initialSeed("공고 하나 살펴보기"), initialSeed("이력서 한 줄 쓰기"), initialSeed("답변 키워드 적기"))
        );
    }

    private static QuestSeed initialSeed(String title) {
        return new QuestSeed(
                title,
                "오늘 할 작은 행동입니다.",
                "결과를 한 줄 남깁니다.",
                List.of("자료 열기", "한 줄 남기기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                10,
                true
        );
    }

    static QuestSeed replacementSeed() {
        return new QuestSeed(
                "자료 위치 확인하기",
                "원래 목적을 유지한 작은 행동입니다.",
                "자료 위치를 기록합니다.",
                List.of("폴더 하나 열기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                5,
                true
        );
    }
}
