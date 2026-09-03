package com.restartquest.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    boolean existsByEmail(String email);

    Optional<Account> findByEmail(String email);
}
