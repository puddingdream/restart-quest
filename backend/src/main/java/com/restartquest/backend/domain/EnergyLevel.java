package com.restartquest.backend.domain;

import java.util.Locale;

public enum EnergyLevel {
    LOW,
    MEDIUM,
    HIGH;

    public static EnergyLevel parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("energyLevel is required");
        }
        return EnergyLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
