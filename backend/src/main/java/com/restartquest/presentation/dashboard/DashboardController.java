package com.restartquest.presentation.dashboard;

import com.restartquest.application.dashboard.DashboardQueryService;
import com.restartquest.infrastructure.security.AuthenticatedUser;
import com.restartquest.presentation.dashboard.dto.TodayDashboardResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardQueryService dashboardQueryService;

    public DashboardController(DashboardQueryService dashboardQueryService) {
        this.dashboardQueryService = dashboardQueryService;
    }

    @GetMapping("/today")
    public TodayDashboardResponse getToday(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser
    ) {
        return TodayDashboardResponse.from(dashboardQueryService.getToday(authenticatedUser.userId()));
    }
}
