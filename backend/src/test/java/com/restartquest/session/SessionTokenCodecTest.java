package com.restartquest.session;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SessionTokenCodecTest {

    private final SessionTokenCodec codec = new SessionTokenCodec();

    @Test
    void generates256BitUrlSafeTokensAndStableSha256Digests() {
        Set<String> tokens = new HashSet<>();

        for (int index = 0; index < 100; index++) {
            String token = codec.generate();
            assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
            assertThat(codec.digest(token)).hasSize(64).matches("[0-9a-f]{64}");
            assertThat(tokens.add(token)).isTrue();
        }

        assertThat(codec.digest("same-token")).isEqualTo(codec.digest("same-token"));
        assertThat(codec.digest("same-token")).isNotEqualTo(codec.digest("other-token"));
    }
}
