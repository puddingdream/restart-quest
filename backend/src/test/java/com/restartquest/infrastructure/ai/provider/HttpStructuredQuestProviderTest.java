package com.restartquest.infrastructure.ai.provider;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.PersonalizationPayload;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class HttpStructuredQuestProviderTest {

    @Test
    void malformedJsonIsClassifiedAsInvalidResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpStructuredQuestProvider provider = new HttpStructuredQuestProvider(
                builder,
                "https://provider.example.test",
                "test-api-key"
        );
        server.expect(requestTo("https://provider.example.test/quests/generate"))
                .andRespond(withSuccess("{not-json", MediaType.APPLICATION_JSON));

        GenerationRequest request = new GenerationRequest(new PersonalizationPayload(
                "백엔드 개발자", "서울", "FULL_TIME", 3, true, "LIMITED", "LOW"
        ));

        assertThatThrownBy(() -> provider.generate(request))
                .isInstanceOfSatisfying(ProviderException.class, exception ->
                        org.assertj.core.api.Assertions.assertThat(exception.getFailureType())
                                .isEqualTo(ProviderException.FailureType.INVALID_RESPONSE)
                );
        server.verify();
    }
}
