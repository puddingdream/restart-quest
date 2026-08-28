package com.restartquest.infrastructure.persistence;

import com.restartquest.application.port.UserStore;
import com.restartquest.domain.user.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public class UserStoreAdapter implements UserStore {

    private final JpaUserRepository repository;

    public UserStoreAdapter(JpaUserRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean existsByEmail(String email) {
        return repository.existsByEmail(email);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return repository.findByEmail(email);
    }

    @Override
    public Optional<User> findById(UUID id) {
        return repository.findById(id);
    }

    @Override
    public User save(User user) {
        return repository.saveAndFlush(user);
    }
}

interface JpaUserRepository extends JpaRepository<User, UUID> {

    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);
}
