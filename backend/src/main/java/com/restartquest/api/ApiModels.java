package com.restartquest.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class ApiModels {
    private ApiModels() {}

    public record SessionRequest(String timezone) {}

    public record ActionInput(
            @NotBlank String title,
            @Min(2) @Max(30) int estimatedMinutes) {}

    public record CreateQuestRequest(
            @NotBlank String title,
            @NotNull @Valid ActionInput firstAction) {}

    public enum Outcome { DONE, BLOCKED }
    public enum BlockerCode { TOO_BIG, LOW_ENERGY, UNCLEAR, NO_TIME, OTHER }

    public record AttemptRequest(
            @NotNull Outcome outcome,
            BlockerCode blockerCode,
            String note) {}

    public record AdaptationRequest(
            @NotBlank String title,
            @Min(2) @Max(30) int estimatedMinutes) {}

    public record VersionRequest(@NotNull @Min(0) Long version) {}
}
