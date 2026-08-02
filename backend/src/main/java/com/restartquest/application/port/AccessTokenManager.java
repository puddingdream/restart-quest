package com.restartquest.application.port;

import java.util.Optional;
import java.util.UUID;

public interface AccessTokenManager {

    String issue(UUID userId);

    Optional<UUID> findUserId(String rawToken);
}
