package com.restartquest.infrastructure.ai.provider;

import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationResponse;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignResponse;

public interface StructuredQuestProvider {

    GenerationResponse generate(GenerationRequest request);

    RedesignResponse redesign(RedesignRequest request);
}
