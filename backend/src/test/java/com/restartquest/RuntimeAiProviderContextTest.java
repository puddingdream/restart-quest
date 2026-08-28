package com.restartquest;

import com.restartquest.application.port.QuestAiClient;
import com.restartquest.infrastructure.ai.ProviderQuestAiClient;
import com.restartquest.infrastructure.ai.provider.HttpStructuredQuestProvider;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "restartquest.ai.provider=runtime",
        "restartquest.ai.runtime.base-url=http://127.0.0.1:65535",
        "restartquest.ai.runtime.api-key=test-placeholder"
})
class RuntimeAiProviderContextTest {

    @Autowired
    private QuestAiClient questAiClient;

    @Autowired
    private StructuredQuestProvider structuredQuestProvider;

    @Test
    void runtimeProfileProvidesConcreteAiAdaptersWithoutCallingNetwork() {
        assertThat(questAiClient).isInstanceOf(ProviderQuestAiClient.class);
        assertThat(structuredQuestProvider).isInstanceOf(HttpStructuredQuestProvider.class);
    }
}
