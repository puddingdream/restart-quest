package com.restartquest.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration(proxyBeanMethods = false)
class AuthConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }
}
