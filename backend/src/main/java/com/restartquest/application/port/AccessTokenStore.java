package com.restartquest.application.port;

import com.restartquest.domain.user.AccessToken;
import java.util.Optional;

public interface AccessTokenStore {

    AccessToken save(AccessToken accessToken);

    Optional<AccessToken> findByTokenHash(String tokenHash);
}
