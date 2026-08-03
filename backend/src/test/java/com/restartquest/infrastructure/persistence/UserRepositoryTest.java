package com.restartquest.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restartquest.domain.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

@DataJpaTest
class UserRepositoryTest {

    @Autowired
    private JpaUserRepository userRepository;

    @Test
    void emailHasDatabaseUniqueConstraint() {
        userRepository.saveAndFlush(User.create("duplicate@example.com", "first-hash", "첫 사용자"));

        assertThatThrownBy(() -> userRepository.saveAndFlush(
                User.create("duplicate@example.com", "second-hash", "두번째 사용자")
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findsUserByNormalizedEmail() {
        User saved = userRepository.saveAndFlush(
                User.create("member@example.com", "password-hash", "회원")
        );

        assertThat(userRepository.findByEmail("member@example.com"))
                .contains(saved);
        assertThat(userRepository.existsByEmail("member@example.com")).isTrue();
    }
}
