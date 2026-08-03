package com.restartquest.infrastructure.ai.provider;

import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationResponse;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignResponse;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
    public HttpStructuredQuestProvider(
            @Value("${restartquest.ai.runtime.base-url}") String baseUrl,
            @Value("${restartquest.ai.runtime.api-key}") String apiKey
    ) {
        this(RestClient.builder(), baseUrl, apiKey);
    }

    HttpStructuredQuestProvider(
            RestClient.Builder builder,
            String baseUrl,
            String apiKey
    ) {
        this.restClient = builder
                .baseUrl(requiredSetting(baseUrl, "base URL"))
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + requiredSetting(apiKey, "API key"))
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
            if (hasCause(exception, SocketTimeoutException.class)
                    || hasCause(exception, HttpTimeoutException.class)) {
                throw new ProviderException(ProviderException.FailureType.TIMEOUT);
            }
            throw new ProviderException(ProviderException.FailureType.UNAVAILABLE);
        } catch (ProviderException exception) {
            throw exception;
        } catch (RestClientException exception) {
            if (hasCause(exception, HttpMessageConversionException.class)) {
                throw new ProviderException(ProviderException.FailureType.INVALID_RESPONSE);
            }
            throw new ProviderException(ProviderException.FailureType.UNAVAILABLE);
        }
    }

    private static String requiredSetting(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Runtime AI provider " + name + " is not configured.");
        }
        return value.trim();
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
