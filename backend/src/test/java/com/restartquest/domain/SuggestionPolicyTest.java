package com.restartquest.domain;

import com.restartquest.api.ApiModels.BlockerCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SuggestionPolicyTest {
    private final SuggestionPolicy policy = new SuggestionPolicy();

    @Test
    void createsDeterministicSuggestionsForEveryBlocker() {
        assertThat(policy.suggest(BlockerCode.TOO_BIG, "지원서 작성", 11).estimatedMinutes()).isEqualTo(5);
        assertThat(policy.suggest(BlockerCode.LOW_ENERGY, "지원서 작성", 11).estimatedMinutes()).isEqualTo(2);
        assertThat(policy.suggest(BlockerCode.UNCLEAR, "지원서 작성", 11).estimatedMinutes()).isEqualTo(5);
        assertThat(policy.suggest(BlockerCode.NO_TIME, "지원서 작성", 11).estimatedMinutes()).isEqualTo(2);
        assertThat(policy.suggest(BlockerCode.OTHER, "지원서 작성", 11).estimatedMinutes()).isEqualTo(5);
        assertThat(policy.suggest(BlockerCode.TOO_BIG, "지원서 작성", 11))
                .isEqualTo(policy.suggest(BlockerCode.TOO_BIG, "지원서 작성", 11));
    }

    @Test
    void capsSuggestionAtOneHundredUnicodeCodePoints() {
        String original = "😀".repeat(100);
        String title = policy.suggest(BlockerCode.TOO_BIG, original, 10).title();
        assertThat(title.codePointCount(0, title.length())).isEqualTo(100);
        assertThat(title).startsWith("첫 단계만 하기: ");
    }
}
