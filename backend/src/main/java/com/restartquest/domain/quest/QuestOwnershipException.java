package com.restartquest.domain.quest;

public class QuestOwnershipException extends RuntimeException {

    public QuestOwnershipException() {
        super("퀘스트 데이터는 현재 사용자 범위에서만 변경할 수 있습니다.");
    }
}
