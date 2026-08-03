package com.restartquest.infrastructure.persistence;

import com.restartquest.application.port.AccessTokenStore;
import com.restartquest.domain.user.AccessToken;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public class AccessTokenStoreAdapter implements AccessTokenStore {

    private final JpaAccessTokenRepository repository;

    public AccessTokenStoreAdapter(JpaAccessTokenRepository repository) {
        this.repository = repository;
    }

    @Override
    public AccessToken save(AccessToken accessToken) {
        return repository.saveAndFlush(accessToken);
    }

    @Override
    public Optional<AccessToken> findByTokenHash(String tokenHash) {
        return repository.findByTokenHash(tokenHash);
    }
}

interface JpaAccessTokenRepository extends JpaRepository<AccessToken, UUID> {

    Optional<AccessToken> findByTokenHash(String tokenHash);
}
