package com.restartquest.application.user;

import com.restartquest.domain.user.User;

public record AuthResult(String accessToken, User user) {
}
