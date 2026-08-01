package com.restartquest.application.user;

import com.restartquest.application.error.AppException;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.user.User;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserQueryService {

    private final UserStore userStore;

    public UserQueryService(UserStore userStore) {
        this.userStore = userStore;
    }

    @Transactional(readOnly = true)
    public User getUser(UUID userId) {
        return userStore.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "인증이 필요합니다."));
    }
}
