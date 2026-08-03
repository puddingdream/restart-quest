package com.restartquest.infrastructure.ai.provider;

import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationResponse;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
@ConditionalOnProperty(prefix = "restartquest.ai", name = "provider", havingValue = "runtime")
public class HttpStructuredQuestProvider implements StructuredQuestProvider {

    private final RestClient restClient;

    public HttpStructuredQuestProvider(
            RestClient.Builder builder,
            @Value("${restartquest.ai.runtime.base-url}") String baseUrl,
            @Value("${restartquest.ai.runtime.api-key}") String apiKey
    ) {
        this.restClient = builder
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        return post("/quests/generate", request, GenerationResponse.class);
    }

    @Override
    public RedesignResponse redesign(RedesignRequest request) {
        return post("/quests/redesign", request, RedesignResponse.class);
    }

    private <T> T post(String path, Object request, Class<T> responseType) {
        try {
            T response = restClient.post()
                    .uri(path)
                    .body(request)
                    .retrieve()
                    .body(responseType);
            if (response == null) {
                throw new ProviderException(ProviderException.FailureType.INVALID_RESPONSE);
            }
            return response;
        } catch (HttpClientErrorException exception) {
            HttpStatusCode status = exception.getStatusCode();
            if (status.value() == 429) {
                throw new ProviderException(ProviderException.FailureType.QUOTA_EXCEEDED);
            }
            throw new ProviderException(ProviderException.FailureType.UNAVAILABLE);
        } catch (ResourceAccessException exception) {
            throw new ProviderException(ProviderException.FailureType.TIMEOUT);
        } catch (ProviderException exception) {
            throw exception;
        } catch (RestClientException exception) {
            if (hasCause(exception, HttpMessageConversionException.class)) {
                throw new ProviderException(ProviderException.FailureType.INVALID_RESPONSE);
            }
            throw new ProviderException(ProviderException.FailureType.UNAVAILABLE);
        }
    }

    private static boolean hasCause(Throwable error, Class<? extends Throwable> expectedType) {
        Throwable current = error;
        while (current != null) {
            if (expectedType.isInstance(current)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
