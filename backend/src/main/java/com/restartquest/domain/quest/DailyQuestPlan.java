package com.restartquest.domain.quest;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.Check;

@Entity
@Table(
        name = "daily_quest_plans",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_daily_quest_plan_user_date",
                columnNames = {"user_id", "quest_date"}
        )
)
@Check(name = "ck_daily_quest_plan_three_journeys", constraints = "initial_journey_count = 3")
public class DailyQuestPlan {

    private static final int INITIAL_JOURNEY_COUNT = 3;

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "quest_date", nullable = false, updatable = false)
    private LocalDate questDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "energy_level", nullable = false, length = 10, updatable = false)
    private EnergyLevel energyLevel;

    @Column(name = "initial_journey_count", nullable = false, updatable = false)
    private int initialJourneyCount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "dailyQuestPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("initialSlot ASC")
    private List<QuestJourney> journeys = new ArrayList<>();

    protected DailyQuestPlan() {
    }

    private DailyQuestPlan(
            UUID userId,
            LocalDate questDate,
            EnergyLevel energyLevel,
            List<QuestSeed> initialQuests
    ) {
        Objects.requireNonNull(userId, "userId는 필수입니다.");
        Objects.requireNonNull(questDate, "questDate는 필수입니다.");
        Objects.requireNonNull(energyLevel, "energyLevel은 필수입니다.");
        if (initialQuests == null || initialQuests.size() != INITIAL_JOURNEY_COUNT) {
            throw new IllegalArgumentException("일일 계획은 최초 퀘스트가 정확히 3개여야 합니다.");
        }

        this.id = UUID.randomUUID();
        this.userId = userId;
        this.questDate = questDate;
        this.energyLevel = energyLevel;
        this.initialJourneyCount = INITIAL_JOURNEY_COUNT;
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        for (int index = 0; index < initialQuests.size(); index++) {
            journeys.add(QuestJourney.start(this, index + 1, initialQuests.get(index)));
        }
    }

    public static DailyQuestPlan create(
            UUID userId,
            LocalDate questDate,
            EnergyLevel energyLevel,
            List<QuestSeed> initialQuests
    ) {
        return new DailyQuestPlan(userId, questDate, energyLevel, initialQuests);
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public LocalDate getQuestDate() {
        return questDate;
    }

    public EnergyLevel getEnergyLevel() {
        return energyLevel;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public List<QuestJourney> getJourneys() {
        return Collections.unmodifiableList(journeys);
    }
}
