package com.restartquest.infrastructure.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.restartquest.application.port.QuestAiClient;
import com.restartquest.infrastructure.ai.provider.HttpStructuredQuestProvider;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "restartquest.ai.provider=runtime",
        "restartquest.ai.runtime.base-url=https://provider.example.test",
        "restartquest.ai.runtime.api-key=test-api-key"
})
class RuntimeAiProviderContextTest {

    @Autowired
    private QuestAiClient questAiClient;

    @Autowired
    private StructuredQuestProvider structuredQuestProvider;

    @Test
    void runtimeModeRegistersProviderAndClientBeans() {
        assertThat(structuredQuestProvider).isInstanceOf(HttpStructuredQuestProvider.class);
        assertThat(questAiClient).isInstanceOf(ProviderQuestAiClient.class);
    }
}
