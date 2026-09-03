package com.restartquest.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.stereotype.Service;

@Service
class AuthSessionService {

    private final CsrfTokenRepository csrfTokenRepository;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();
    private final ChangeSessionIdAuthenticationStrategy sessionAuthenticationStrategy =
            new ChangeSessionIdAuthenticationStrategy();

    AuthSessionService(CsrfTokenRepository csrfTokenRepository) {
        this.csrfTokenRepository = csrfTokenRepository;
    }

    void authenticate(
            AuthenticatedAccount account,
            HttpServletRequest request,
            HttpServletResponse response) {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                account,
                null,
                List.of());
        sessionAuthenticationStrategy.onAuthentication(authentication, request, response);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        csrfTokenRepository.saveToken(null, request, response);
    }

    void logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        csrfTokenRepository.saveToken(null, request, response);
    }
}
