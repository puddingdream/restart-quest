package com.restartquest.presentation.quest.dto;

import com.restartquest.domain.quest.EnergyLevel;
import jakarta.validation.constraints.NotNull;

public record GenerateDailyQuestsRequest(
        @NotNull(message = "energyLevel은 필수입니다.") EnergyLevel energyLevel
) {
}
