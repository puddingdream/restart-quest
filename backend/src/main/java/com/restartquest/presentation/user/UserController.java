package com.restartquest.presentation.user;

import com.restartquest.application.user.UserQueryService;
import com.restartquest.infrastructure.security.AuthenticatedUser;
import com.restartquest.presentation.auth.dto.UserResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserQueryService userQueryService;

    public UserController(UserQueryService userQueryService) {
        this.userQueryService = userQueryService;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return UserResponse.from(userQueryService.getUser(authenticatedUser.userId()));
    }
}
