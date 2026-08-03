package com.restartquest.application.port;

import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.application.ai.RedesignedQuest;

public interface QuestAiClient {

    GeneratedQuestBatch generateDailyQuests(QuestGenerationRequest request);

    RedesignedQuest redesignQuest(QuestRedesignRequest request);
}
