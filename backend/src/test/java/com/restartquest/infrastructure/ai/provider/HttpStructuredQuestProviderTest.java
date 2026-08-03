package com.restartquest.infrastructure.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationResponse;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.PersonalizationPayload;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class HttpStructuredQuestProviderTest {

    @Test
    void postsTypedRequestWithBearerCredentialAndReadsTypedResponse() {
        ProviderFixture fixture = fixture();
        fixture.server().expect(requestTo("https://provider.example.test/quests/generate"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-api-key"))
                .andRespond(withSuccess("""
                        {
                          "quests": [
                            {
                              "title": "첫 단계",
                              "description": "작게 시작합니다.",
                              "completionCriteria": "한 단계를 마칩니다.",
                              "steps": ["한 단계 실행하기"],
                              "category": "ROUTINE",
                              "difficulty": "EASY",
                              "estimatedMinutes": 5
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        GenerationResponse response = fixture.provider().generate(generationRequest());

        assertThat(response.quests()).singleElement()
                .satisfies(quest -> assertThat(quest.title()).isEqualTo("첫 단계"));
        fixture.server().verify();
    }

    @Test
    void malformedJsonIsClassifiedAsInvalidResponse() {
        ProviderFixture fixture = fixture();
        fixture.server().expect(requestTo("https://provider.example.test/quests/generate"))
                .andRespond(withSuccess("{not-json", MediaType.APPLICATION_JSON));

        assertFailureType(fixture.provider(), ProviderException.FailureType.INVALID_RESPONSE);
        fixture.server().verify();
    }

    @Test
    void quotaResponseIsClassifiedAsQuotaExceeded() {
        ProviderFixture fixture = fixture();
        fixture.server().expect(requestTo("https://provider.example.test/quests/generate"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertFailureType(fixture.provider(), ProviderException.FailureType.QUOTA_EXCEEDED);
        fixture.server().verify();
    }

    @Test
    void socketTimeoutIsClassifiedAsTimeout() {
        ProviderFixture fixture = fixture();
        fixture.server().expect(requestTo("https://provider.example.test/quests/generate"))
                .andRespond(withException(new SocketTimeoutException("read timed out")));

        assertFailureType(fixture.provider(), ProviderException.FailureType.TIMEOUT);
        fixture.server().verify();
    }

    @Test
    void connectionFailureIsClassifiedAsUnavailable() {
        ProviderFixture fixture = fixture();
        fixture.server().expect(requestTo("https://provider.example.test/quests/generate"))
                .andRespond(withException(new ConnectException("connection refused")));

        assertFailureType(fixture.provider(), ProviderException.FailureType.UNAVAILABLE);
        fixture.server().verify();
    }

    @Test
    void blankRuntimeConfigurationFailsAtStartupBoundary() {
        assertThatThrownBy(() -> new HttpStructuredQuestProvider(RestClient.builder(), " ", "test-api-key"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("base URL");
        assertThatThrownBy(() -> new HttpStructuredQuestProvider(
                RestClient.builder(), "https://provider.example.test", " "
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("API key");
    }

    private static ProviderFixture fixture() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        return new ProviderFixture(
                new HttpStructuredQuestProvider(builder, "https://provider.example.test", "test-api-key"),
                server
        );
    }

    private static void assertFailureType(
            HttpStructuredQuestProvider provider,
            ProviderException.FailureType expected
    ) {
        assertThatThrownBy(() -> provider.generate(generationRequest()))
                .isInstanceOfSatisfying(ProviderException.class, exception ->
                        assertThat(exception.getFailureType()).isEqualTo(expected)
                );
    }

    private static GenerationRequest generationRequest() {
        return new GenerationRequest(new PersonalizationPayload(
                "백엔드 개발자", "서울", "FULL_TIME", 3, true, "LIMITED", "LOW"
        ));
    }

    private record ProviderFixture(
            HttpStructuredQuestProvider provider,
            MockRestServiceServer server
    ) {
    }
}
