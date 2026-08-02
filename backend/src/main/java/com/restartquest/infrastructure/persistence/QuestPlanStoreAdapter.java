package com.restartquest.infrastructure.persistence;

import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestOwnershipException;
import com.restartquest.domain.quest.QuestStatus;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class QuestPlanStoreAdapter implements QuestPlanStore {

    private final JpaDailyQuestPlanRepository planRepository;
    private final JpaQuestJourneyRepository journeyRepository;
    private final JdbcTemplate jdbcTemplate;

    public QuestPlanStoreAdapter(
            JpaDailyQuestPlanRepository planRepository,
            JpaQuestJourneyRepository journeyRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.planRepository = planRepository;
        this.journeyRepository = journeyRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public DailyQuestPlan saveForUser(UUID userId, DailyQuestPlan plan) {
        verifyOwner(userId, plan.getUserId());
        return planRepository.saveAndFlush(plan);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DailyQuestPlan> findByDateForUser(UUID userId, LocalDate questDate) {
        return planRepository.findByUserIdAndQuestDate(userId, questDate)
                .map(QuestPlanStoreAdapter::initializePlan);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<QuestJourney> findJourneyForUser(UUID userId, UUID journeyId) {
        return journeyRepository.findOwnedJourney(userId, journeyId)
                .map(QuestPlanStoreAdapter::initializeJourney);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<QuestJourney> findJourneyByCurrentQuestForUser(UUID userId, UUID questId) {
        return journeyRepository.findOwnedJourneyByCurrentQuest(userId, questId)
                .map(QuestPlanStoreAdapter::initializeJourney);
    }

    @Override
    @Transactional
    public QuestJourney saveJourneyForUser(UUID userId, QuestJourney journey) {
        verifyOwner(userId, journey.getUserId());
        QuestJourney saved = journeyRepository.saveAndFlush(journey);
        if (saved.getCurrentQuest().getStatus() == QuestStatus.TODO) {
            // INSERT가 UPDATE보다 먼저 실행되어도 유일 제약과 충돌하지 않도록 flush 후 활성 marker를 둔다.
            activateCurrentMarker(userId, saved.getCurrentQuestId());
        }
        return saved;
    }

    private void activateCurrentMarker(UUID userId, UUID questId) {
        int updatedRows = jdbcTemplate.update("""
                update quests
                set current_marker = 1
                where id = ?
                  and current_marker is null
                  and journey_id in (
                      select journey.id
                      from quest_journeys journey
                      join daily_quest_plans plan on plan.id = journey.daily_quest_plan_id
                      where plan.user_id = ?
                  )
                """, questId, userId);
        if (updatedRows > 1) {
            throw new IllegalStateException("현재 퀘스트 marker 갱신 범위가 올바르지 않습니다.");
        }
        Integer activeMarkerCount = jdbcTemplate.queryForObject("""
                select count(*)
                from quests quest
                join quest_journeys journey on journey.id = quest.journey_id
                join daily_quest_plans plan on plan.id = journey.daily_quest_plan_id
                where quest.id = ? and quest.current_marker = 1 and plan.user_id = ?
                """, Integer.class, questId, userId);
        if (activeMarkerCount == null || activeMarkerCount != 1) {
            throw new IllegalStateException("현재 퀘스트 marker가 저장되지 않았습니다.");
        }
    }

    private static DailyQuestPlan initializePlan(DailyQuestPlan plan) {
        plan.getJourneys().forEach(QuestPlanStoreAdapter::initializeJourney);
        return plan;
    }

    private static QuestJourney initializeJourney(QuestJourney journey) {
        journey.getQuests().forEach(quest -> quest.getSteps().size());
        journey.getRedesigns().size();
        return journey;
    }

    private static void verifyOwner(UUID expectedUserId, UUID actualUserId) {
        if (!actualUserId.equals(expectedUserId)) {
            throw new QuestOwnershipException();
        }
    }
}

interface JpaDailyQuestPlanRepository extends JpaRepository<DailyQuestPlan, UUID> {

    Optional<DailyQuestPlan> findByUserIdAndQuestDate(UUID userId, LocalDate questDate);
}

interface JpaQuestJourneyRepository extends JpaRepository<QuestJourney, UUID> {

    @Query("""
            select distinct journey
            from QuestJourney journey
            join fetch journey.dailyQuestPlan plan
            left join fetch journey.quests
            where plan.userId = :userId and journey.id = :journeyId
            """)
    Optional<QuestJourney> findOwnedJourney(
            @Param("userId") UUID userId,
            @Param("journeyId") UUID journeyId
    );

    @Query("""
            select distinct journey
            from QuestJourney journey
            join fetch journey.dailyQuestPlan plan
            left join fetch journey.quests
            where plan.userId = :userId and journey.currentQuestId = :questId
            """)
    Optional<QuestJourney> findOwnedJourneyByCurrentQuest(
            @Param("userId") UUID userId,
            @Param("questId") UUID questId
    );
}
