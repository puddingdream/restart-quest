package com.restartquest.quest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "quests")
class Quest {

    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "check_in_id", nullable = false)
    private UUID checkInId;

    @Column(name = "template_key", nullable = false, length = 64)
    private String templateKey;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(name = "estimated_minutes", nullable = false)
    private int estimatedMinutes;

    @Column(nullable = false)
    private int difficulty;

    @Column(name = "recommendation_reason", nullable = false, length = 255)
    private String recommendationReason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private QuestStatus status;

    @Column(name = "predecessor_quest_id")
    private UUID predecessorQuestId;

    @Column(nullable = false)
    private long version;

    @Column(name = "active_marker")
    private Short activeMarker;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Quest() {
    }

    Quest(
            UUID id,
            UUID accountId,
            UUID checkInId,
            ActionCatalog.Recommendation recommendation,
            UUID predecessorQuestId,
            Instant createdAt) {
        ActionCatalog.ActionTemplate template = recommendation.template();
        this.id = id;
        this.accountId = accountId;
        this.checkInId = checkInId;
        this.templateKey = template.key();
        this.title = template.title();
        this.estimatedMinutes = template.minutes();
        this.difficulty = template.difficulty();
        this.recommendationReason = recommendation.reason();
        this.status = QuestStatus.ACTIVE;
        this.predecessorQuestId = predecessorQuestId;
        this.version = 0;
        this.activeMarker = 1;
        this.createdAt = createdAt;
    }

    UUID getId() {
        return id;
    }

    UUID getCheckInId() {
        return checkInId;
    }

    String getTemplateKey() {
        return templateKey;
    }

    String getTitle() {
        return title;
    }

    int getEstimatedMinutes() {
        return estimatedMinutes;
    }

    int getDifficulty() {
        return difficulty;
    }

    String getRecommendationReason() {
        return recommendationReason;
    }

    QuestStatus getStatus() {
        return status;
    }

    UUID getPredecessorQuestId() {
        return predecessorQuestId;
    }

    long getVersion() {
        return version;
    }
}
