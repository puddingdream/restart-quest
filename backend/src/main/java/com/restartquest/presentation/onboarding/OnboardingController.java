package com.restartquest.presentation.onboarding;

import com.restartquest.application.user.OnboardingService;
import com.restartquest.infrastructure.security.AuthenticatedUser;
import com.restartquest.presentation.onboarding.dto.OnboardingRequest;
import com.restartquest.presentation.onboarding.dto.OnboardingResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/onboarding")
public class OnboardingController {

    private final OnboardingService onboardingService;

    public OnboardingController(OnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @GetMapping("/me")
    public OnboardingResponse get(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return OnboardingResponse.from(onboardingService.get(authenticatedUser.userId()));
    }

    @PutMapping("/me")
    public OnboardingResponse upsert(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody OnboardingRequest request
    ) {
        return OnboardingResponse.from(onboardingService.upsert(authenticatedUser.userId(), request.toCommand()));
    }
}
