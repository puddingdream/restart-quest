package com.restartquest.domain.quest;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.Check;

@Entity
@Table(
        name = "quest_journeys",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_quest_journey_plan_slot",
                columnNames = {"daily_quest_plan_id", "initial_slot"}
        )
)
@Check(name = "ck_quest_journey_initial_slot", constraints = "initial_slot between 1 and 3")
public class QuestJourney {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_quest_plan_id", nullable = false, updatable = false)
    private DailyQuestPlan dailyQuestPlan;

    @Column(name = "initial_slot", nullable = false, updatable = false)
    private int initialSlot;

    @Column(name = "root_quest_id", nullable = false, updatable = false)
    private UUID rootQuestId;

    @Column(name = "current_quest_id", nullable = false)
    private UUID currentQuestId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private QuestJourneyStatus status;

    @OneToMany(mappedBy = "journey", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("revision ASC")
    private List<Quest> quests = new ArrayList<>();

    @OneToMany(mappedBy = "journey", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<QuestRedesign> redesigns = new ArrayList<>();

    @Version
    private long version;

    protected QuestJourney() {
    }

    private QuestJourney(DailyQuestPlan dailyQuestPlan, int initialSlot, QuestSeed initialQuest) {
        this.id = UUID.randomUUID();
        this.dailyQuestPlan = Objects.requireNonNull(dailyQuestPlan, "dailyQuestPlan은 필수입니다.");
        if (initialSlot < 1 || initialSlot > 3) {
            throw new IllegalArgumentException("initialSlot은 1부터 3까지만 허용됩니다.");
        }
        this.initialSlot = initialSlot;
        Quest rootQuest = Quest.initial(this, initialQuest);
        this.rootQuestId = rootQuest.getId();
        this.currentQuestId = rootQuest.getId();
        this.status = QuestJourneyStatus.ACTIVE;
        this.quests.add(rootQuest);
    }

    static QuestJourney start(DailyQuestPlan dailyQuestPlan, int initialSlot, QuestSeed initialQuest) {
        return new QuestJourney(dailyQuestPlan, initialSlot, initialQuest);
    }

    public void complete(UUID questId) {
        Quest currentQuest = requireActiveCurrentQuest(questId);
        currentQuest.markDone();
        this.status = QuestJourneyStatus.COMPLETED;
    }

    public QuestRedesign redesign(
            UUID questId,
            QuestSeed replacementSeed,
            QuestRedesignReasonCode reasonCode,
            String reasonNote
    ) {
        Quest originalQuest = requireActiveCurrentQuest(questId);
        validateReplacement(originalQuest, replacementSeed);
        Quest replacementQuest = Quest.replacement(this, originalQuest, replacementSeed);
        QuestRedesign redesign = QuestRedesign.create(
                this,
                originalQuest,
                replacementQuest,
                reasonCode,
                reasonNote
        );

        originalQuest.markRedesigned();
        quests.add(replacementQuest);
        redesigns.add(redesign);
        this.currentQuestId = replacementQuest.getId();
        return redesign;
    }

    private Quest requireActiveCurrentQuest(UUID questId) {
        if (status != QuestJourneyStatus.ACTIVE || !currentQuestId.equals(questId)) {
            throw new IllegalStateException("현재 처리할 수 있는 퀘스트가 아닙니다.");
        }
        Quest currentQuest = getCurrentQuest();
        if (currentQuest.getStatus() != QuestStatus.TODO) {
            throw new IllegalStateException("이미 처리된 퀘스트입니다.");
        }
        return currentQuest;
    }

    private static void validateReplacement(Quest originalQuest, QuestSeed replacementSeed) {
        Objects.requireNonNull(replacementSeed, "replacementQuest는 필수입니다.");
        if (replacementSeed.category() != originalQuest.getCategory()) {
            throw new IllegalArgumentException("대체 퀘스트는 원본과 같은 category여야 합니다.");
        }
        if (replacementSeed.estimatedMinutes() > originalQuest.getEstimatedMinutes()) {
            throw new IllegalArgumentException("대체 퀘스트는 원본보다 오래 걸릴 수 없습니다.");
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getDailyQuestPlanId() {
        return dailyQuestPlan.getId();
    }

    public UUID getUserId() {
        return dailyQuestPlan.getUserId();
    }

    public int getInitialSlot() {
        return initialSlot;
    }

    public UUID getRootQuestId() {
        return rootQuestId;
    }

    public UUID getCurrentQuestId() {
        return currentQuestId;
    }

    public QuestJourneyStatus getStatus() {
        return status;
    }

    public Quest getCurrentQuest() {
        return quests.stream()
                .filter(quest -> quest.getId().equals(currentQuestId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("현재 퀘스트를 찾을 수 없습니다."));
    }

    public List<Quest> getQuests() {
        return Collections.unmodifiableList(quests);
    }

    public List<QuestRedesign> getRedesigns() {
        return Collections.unmodifiableList(redesigns);
    }
}
