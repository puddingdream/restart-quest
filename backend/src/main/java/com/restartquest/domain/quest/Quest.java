package com.restartquest.domain.quest;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
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
        name = "quests",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_quest_journey_revision",
                        columnNames = {"journey_id", "revision"}
                ),
                @UniqueConstraint(
                        name = "uq_quest_journey_current",
                        columnNames = {"journey_id", "current_marker"}
                ),
                @UniqueConstraint(
                        name = "uq_quest_id_journey",
                        columnNames = {"id", "journey_id"}
                )
        }
)
@Check(
        name = "ck_quest_current_marker",
        constraints = "current_marker is null or current_marker = 1"
)
public class Quest {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journey_id", nullable = false, updatable = false)
    private QuestJourney journey;

    @Column(name = "parent_quest_id", updatable = false)
    private UUID parentQuestId;

    @Column(nullable = false, updatable = false)
    private int revision;

    @Column(nullable = false, length = 120, updatable = false)
    private String title;

    @Column(nullable = false, length = 600, updatable = false)
    private String description;

    @Column(name = "completion_criteria", nullable = false, length = 300, updatable = false)
    private String completionCriteria;

    @ElementCollection
    @CollectionTable(name = "quest_steps", joinColumns = @JoinColumn(name = "quest_id"))
    @OrderColumn(name = "step_order")
    @Column(name = "step", nullable = false, length = 160)
    private List<String> steps = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private QuestCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private QuestDifficulty difficulty;

    @Column(name = "estimated_minutes", nullable = false, updatable = false)
    private int estimatedMinutes;

    @Column(nullable = false, length = 15)
    private String status;

    @Column(name = "current_marker")
    private Integer currentMarker;

    @Column(name = "generated_by_ai", nullable = false, updatable = false)
    private boolean generatedByAi;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Version
    private long version;

    protected Quest() {
    }

    private Quest(QuestJourney journey, UUID parentQuestId, int revision, QuestSeed seed, boolean initial) {
        this.journey = Objects.requireNonNull(journey, "journey는 필수입니다.");
        validateSeed(seed, initial);
        this.id = UUID.randomUUID();
        this.parentQuestId = parentQuestId;
        this.revision = revision;
        this.title = seed.title();
        this.description = seed.description();
        this.completionCriteria = seed.completionCriteria();
        this.steps.addAll(seed.steps());
        this.category = seed.category();
        this.difficulty = seed.difficulty();
        this.estimatedMinutes = seed.estimatedMinutes();
        this.status = QuestStatus.TODO.name();
        this.currentMarker = initial ? 1 : null;
        this.generatedByAi = seed.generatedByAi();
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    static Quest initial(QuestJourney journey, QuestSeed seed) {
        return new Quest(journey, null, 0, seed, true);
    }

    static Quest replacement(QuestJourney journey, Quest original, QuestSeed seed) {
        return new Quest(journey, original.id, original.revision + 1, seed, false);
    }

    void markDone() {
        requireTodo();
        this.status = QuestStatus.DONE.name();
        this.currentMarker = null;
        this.completedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    void markRedesigned() {
        requireTodo();
        this.status = QuestStatus.REDESIGNED.name();
        this.currentMarker = null;
    }

    private void requireTodo() {
        if (!QuestStatus.TODO.name().equals(status)) {
            throw new IllegalStateException("이미 처리된 퀘스트입니다.");
        }
    }

    private static void validateSeed(QuestSeed seed, boolean initial) {
        Objects.requireNonNull(seed, "quest는 필수입니다.");
        requireText(seed.title(), 120, "title");
        requireText(seed.description(), 600, "description");
        requireText(seed.completionCriteria(), 300, "completionCriteria");
        Objects.requireNonNull(seed.category(), "category는 필수입니다.");
        Objects.requireNonNull(seed.difficulty(), "difficulty는 필수입니다.");
        if (seed.steps() == null || seed.steps().isEmpty() || seed.steps().size() > 3) {
            throw new IllegalArgumentException("steps는 1개 이상 3개 이하여야 합니다.");
        }
        seed.steps().forEach(step -> requireText(step, 160, "step"));
        int minimumMinutes = initial ? 10 : 5;
        int maximumMinutes = initial ? 30 : 15;
        if (seed.estimatedMinutes() < minimumMinutes || seed.estimatedMinutes() > maximumMinutes) {
            throw new IllegalArgumentException(
                    "estimatedMinutes는 " + minimumMinutes + "분 이상 " + maximumMinutes + "분 이하여야 합니다."
            );
        }
    }

    private static void requireText(String value, int maximumLength, String field) {
        if (value == null || value.isBlank() || value.length() > maximumLength) {
            throw new IllegalArgumentException(field + " 값이 비어 있거나 허용 길이를 초과했습니다.");
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getJourneyId() {
        return journey.getId();
    }

    public UUID getParentQuestId() {
        return parentQuestId;
    }

    public int getRevision() {
        return revision;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getCompletionCriteria() {
        return completionCriteria;
    }

    public List<String> getSteps() {
        return Collections.unmodifiableList(steps);
    }

    public QuestCategory getCategory() {
        return category;
    }

    public QuestDifficulty getDifficulty() {
        return difficulty;
    }

    public int getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public QuestStatus getStatus() {
        return QuestStatus.valueOf(status);
    }

    public boolean isGeneratedByAi() {
        return generatedByAi;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }
}
