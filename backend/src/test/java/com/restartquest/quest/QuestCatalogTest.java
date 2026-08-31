package com.restartquest.quest;

import static org.assertj.core.api.Assertions.assertThat;

import com.restartquest.quest.QuestModels.EnergyLevel;
import com.restartquest.quest.QuestModels.FrictionReason;
import com.restartquest.quest.QuestModels.GoalType;
import org.junit.jupiter.api.Test;

class QuestCatalogTest {

    private final QuestCatalog catalog = new QuestCatalog();

    @Test
    void everyGoalEnergyAndTimeCombinationHasAStableVersionedAction() {
        for (GoalType goalType : GoalType.values()) {
            for (EnergyLevel energyLevel : EnergyLevel.values()) {
                for (int availableMinutes : new int[] {5, 15, 30}) {
                    var first = catalog.initial(goalType, energyLevel, availableMinutes);
                    var second = catalog.initial(goalType, energyLevel, availableMinutes);

                    assertThat(second).isEqualTo(first);
                    assertThat(first.key()).endsWith("-" + QuestCatalog.VERSION);
                    assertThat(first.estimatedMinutes()).isLessThanOrEqualTo(availableMinutes);
                    assertThat(first.difficultyLevel()).isBetween(1, 3);
                }
            }
        }
    }

    @Test
    void completionSelectsAnotherDeterministicActionAtConfiguredCapacity() {
        var initial = catalog.initial(GoalType.JOB_SEARCH, EnergyLevel.HIGH, 30);

        var next = catalog.afterCompletion(
                GoalType.JOB_SEARCH, EnergyLevel.HIGH, 30, initial.key());

        assertThat(next.key()).isNotEqualTo(initial.key());
        assertThat(catalog.afterCompletion(
                        GoalType.JOB_SEARCH, EnergyLevel.HIGH, 30, initial.key()))
                .isEqualTo(next);
        assertThat(next.difficultyLevel()).isEqualTo(initial.difficultyLevel());
    }

    @Test
    void reframeAlwaysLowersDifficultyOrUsesTwoMinuteFallback() {
        var easier = catalog.afterReframe(
                GoalType.RESUME, 3, FrictionReason.UNCLEAR);
        var lowest = catalog.afterReframe(
                GoalType.RESUME, 1, FrictionReason.LOW_ENERGY);

        assertThat(easier.difficultyLevel()).isEqualTo(2);
        assertThat(lowest).isEqualTo(catalog.fallback(GoalType.RESUME));
        assertThat(lowest.estimatedMinutes()).isLessThanOrEqualTo(2);
        assertThat(lowest.key()).endsWith("-" + QuestCatalog.VERSION);
    }
}
