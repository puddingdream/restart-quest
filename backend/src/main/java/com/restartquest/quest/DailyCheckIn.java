package com.restartquest.quest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "daily_check_ins")
class DailyCheckIn {

    @Id
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "local_date", nullable = false)
    private LocalDate localDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "energy_level", nullable = false, length = 16)
    private EnergyLevel energyLevel;

    @Column(name = "available_minutes", nullable = false)
    private int availableMinutes;

    @Enumerated(EnumType.STRING)
    @Column(name = "focus_area", nullable = false, length = 16)
    private FocusArea focusArea;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DailyCheckIn() {
    }

    DailyCheckIn(
            UUID id,
            UUID accountId,
            LocalDate localDate,
            EnergyLevel energyLevel,
            int availableMinutes,
            FocusArea focusArea,
            Instant createdAt) {
        this.id = id;
        this.accountId = accountId;
        this.localDate = localDate;
        this.energyLevel = energyLevel;
        this.availableMinutes = availableMinutes;
        this.focusArea = focusArea;
        this.createdAt = createdAt;
    }

    UUID getId() {
        return id;
    }

    LocalDate getLocalDate() {
        return localDate;
    }

    EnergyLevel getEnergyLevel() {
        return energyLevel;
    }

    int getAvailableMinutes() {
        return availableMinutes;
    }

    FocusArea getFocusArea() {
        return focusArea;
    }
}
