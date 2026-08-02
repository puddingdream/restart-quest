package com.restartquest.domain.quest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.Check;

@Entity
@Table(
        name = "quest_redesigns",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_quest_redesign_original", columnNames = "original_quest_id"),
                @UniqueConstraint(name = "uq_quest_redesign_replacement", columnNames = "replacement_quest_id")
        }
)
@Check(
        name = "ck_quest_redesign_same_journey",
        constraints = "journey_id = original_journey_id and journey_id = replacement_journey_id"
)
public class QuestRedesign {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journey_id", nullable = false, updatable = false)
    private QuestJourney journey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns({
            @JoinColumn(
                    name = "original_quest_id",
                    referencedColumnName = "id",
                    nullable = false,
                    updatable = false
            ),
            @JoinColumn(
                    name = "original_journey_id",
                    referencedColumnName = "journey_id",
                    nullable = false,
                    updatable = false
            )
    })
    private Quest originalQuest;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns({
            @JoinColumn(
                    name = "replacement_quest_id",
                    referencedColumnName = "id",
                    nullable = false,
                    updatable = false
            ),
            @JoinColumn(
                    name = "replacement_journey_id",
                    referencedColumnName = "journey_id",
                    nullable = false,
                    updatable = false
            )
    })
    private Quest replacementQuest;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", nullable = false, length = 30, updatable = false)
    private QuestRedesignReasonCode reasonCode;

    @Column(name = "reason_note", length = 300, updatable = false)
    private String reasonNote;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected QuestRedesign() {
    }

    private QuestRedesign(
            QuestJourney journey,
            Quest originalQuest,
            Quest replacementQuest,
            QuestRedesignReasonCode reasonCode,
            String reasonNote
    ) {
        this.id = UUID.randomUUID();
        this.journey = Objects.requireNonNull(journey, "journey는 필수입니다.");
        this.originalQuest = Objects.requireNonNull(originalQuest, "originalQuest는 필수입니다.");
        this.replacementQuest = Objects.requireNonNull(replacementQuest, "replacementQuest는 필수입니다.");
        this.reasonCode = Objects.requireNonNull(reasonCode, "reasonCode는 필수입니다.");
        if (!originalQuest.getJourneyId().equals(journey.getId())
                || !replacementQuest.getJourneyId().equals(journey.getId())) {
            throw new IllegalArgumentException("원본과 대체 퀘스트는 같은 여정에 속해야 합니다.");
        }
        if (reasonNote != null && reasonNote.length() > 300) {
            throw new IllegalArgumentException("reasonNote는 300자를 초과할 수 없습니다.");
        }
        this.reasonNote = reasonNote;
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    static QuestRedesign create(
            QuestJourney journey,
            Quest originalQuest,
            Quest replacementQuest,
            QuestRedesignReasonCode reasonCode,
            String reasonNote
    ) {
        return new QuestRedesign(
                journey,
                originalQuest,
                replacementQuest,
                reasonCode,
                reasonNote
        );
    }

    public UUID getId() {
        return id;
    }

    public UUID getJourneyId() {
        return journey.getId();
    }

    public UUID getOriginalQuestId() {
        return originalQuest.getId();
    }

    public UUID getReplacementQuestId() {
        return replacementQuest.getId();
    }

    public QuestRedesignReasonCode getReasonCode() {
        return reasonCode;
    }

    public String getReasonNote() {
        return reasonNote;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
