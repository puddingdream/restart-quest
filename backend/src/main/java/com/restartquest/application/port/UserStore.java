package com.restartquest.application.port;

import com.restartquest.domain.user.User;
import java.util.Optional;
import java.util.UUID;

public interface UserStore {

    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    Optional<User> findById(UUID id);

    User save(User user);
}
