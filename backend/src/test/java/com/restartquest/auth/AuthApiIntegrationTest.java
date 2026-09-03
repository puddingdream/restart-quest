package com.restartquest.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.restartquest.config.PlatformTime;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:identity;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "server.servlet.session.cookie.secure=false"
})
@AutoConfigureMockMvc
class AuthApiIntegrationTest {

    private static final String PASSWORD = "long-enough-password";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RegistrationEmailLock registrationEmailLock;

    @Autowired
    private AccountRepository accounts;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PlatformTime time;

    @BeforeEach
    void clearAccounts() {
        accounts.deleteAll();
    }

    @Test
    void registersNormalizedUniqueEmailAndStoresOnlyItsPasswordHash() throws Exception {
        MockHttpSession session = new MockHttpSession();
        String previousSessionId = session.getId();
        CsrfExchange csrf = csrf(session);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .session(session)
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .with(remoteAddress("198.51.100.10"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"  First.User@Example.COM  ","password":"long-enough-password"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.id").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("first.user@example.com"))
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0))
                .andReturn();

        MockHttpSession authenticatedSession = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(authenticatedSession).isNotNull();
        assertThat(authenticatedSession.getId()).isNotEqualTo(previousSessionId);

        Account stored = accounts.findByEmail("first.user@example.com").orElseThrow();
        assertThat(stored.getPasswordHash()).doesNotContain(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, stored.getPasswordHash())).isTrue();

        CsrfExchange duplicateCsrf = csrf(new MockHttpSession());
        mockMvc.perform(post("/api/v1/auth/register")
                        .session(duplicateCsrf.session())
                        .cookie(duplicateCsrf.cookie())
                        .header(duplicateCsrf.headerName(), duplicateCsrf.token())
                        .with(remoteAddress("198.51.100.11"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"FIRST.USER@example.com","password":"another-long-password"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_USED"));

        assertThat(accounts.count()).isOne();
    }

    @Test
    void validatesRegistrationWithoutEchoingSubmittedValues() throws Exception {
        CsrfExchange csrf = csrf(new MockHttpSession());
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .session(csrf.session())
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .with(remoteAddress("198.51.100.20"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","password":"too-short"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists())
                .andReturn();

        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("not-an-email")
                .doesNotContain("too-short");
    }

    @Test
    void acceptsAndAuthenticatesASeventyTwoCharacterUnicodePassword() throws Exception {
        String unicodePassword = "가".repeat(72);
        CsrfExchange registrationCsrf = csrf(new MockHttpSession());
        mockMvc.perform(post("/api/v1/auth/register")
                        .session(registrationCsrf.session())
                        .cookie(registrationCsrf.cookie())
                        .header(registrationCsrf.headerName(), registrationCsrf.token())
                        .with(remoteAddress("198.51.100.21"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"unicode@example.com\",\"password\":\""
                                + unicodePassword + "\"}"))
                .andExpect(status().isCreated());

        login("unicode@example.com", unicodePassword, "198.51.100.22")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("unicode@example.com"));
    }

    @Test
    void rotatesSessionAndCsrfOnLoginThenSupportsMeAndLogout() throws Exception {
        createAccount("return@example.com", PASSWORD);
        MockHttpSession session = new MockHttpSession();
        String previousSessionId = session.getId();
        CsrfExchange loginCsrf = csrf(session);

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .cookie(loginCsrf.cookie())
                        .header(loginCsrf.headerName(), loginCsrf.token())
                        .with(remoteAddress("198.51.100.30"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"RETURN@EXAMPLE.COM","password":"long-enough-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("return@example.com"))
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0))
                .andReturn();

        MockHttpSession authenticatedSession = (MockHttpSession) login.getRequest().getSession(false);
        assertThat(authenticatedSession.getId()).isNotEqualTo(previousSessionId);

        mockMvc.perform(get("/api/v1/auth/me").session(authenticatedSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("return@example.com"));

        CsrfExchange logoutCsrf = csrf(authenticatedSession);
        assertThat(logoutCsrf.token()).isNotEqualTo(loginCsrf.token());
        mockMvc.perform(post("/api/v1/auth/logout")
                        .session(authenticatedSession)
                        .cookie(logoutCsrf.cookie())
                        .header(logoutCsrf.headerName(), logoutCsrf.token()))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0));

        assertThatThrownBy(() -> authenticatedSession.getAttribute("SPRING_SECURITY_CONTEXT"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void returnsTheSameCredentialFailureForExistingAndMissingAccounts() throws Exception {
        createAccount("known@example.com", PASSWORD);

        MvcResult existing = login(
                "known@example.com",
                "incorrect-password",
                "198.51.100.40")
                .andExpect(status().isUnauthorized())
                .andReturn();
        MvcResult missing = login(
                "missing@example.com",
                "incorrect-password",
                "198.51.100.40")
                .andExpect(status().isUnauthorized())
                .andReturn();

        String existingBody = existing.getResponse().getContentAsString();
        String missingBody = missing.getResponse().getContentAsString();
        assertThat(JsonPath.<String>read(existingBody, "$.code"))
                .isEqualTo(JsonPath.read(missingBody, "$.code"))
                .isEqualTo("INVALID_CREDENTIALS");
        assertThat(JsonPath.<String>read(existingBody, "$.message"))
                .isEqualTo(JsonPath.read(missingBody, "$.message"));
        assertThat(existingBody).doesNotContain("fieldErrors");
        assertThat(missingBody).doesNotContain("fieldErrors");
    }

    @Test
    void rejectsAnonymousAccessAndMissingOrWrongCsrf() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(remoteAddress("198.51.100.50"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"csrf@example.com","password":"long-enough-password"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        CsrfExchange csrf = csrf(new MockHttpSession());
        mockMvc.perform(post("/api/v1/auth/register")
                        .session(csrf.session())
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), "wrong-token")
                        .with(remoteAddress("198.51.100.50"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"csrf@example.com","password":"long-enough-password"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        CsrfExchange logoutCsrf = csrf(new MockHttpSession());
        mockMvc.perform(post("/api/v1/auth/logout")
                        .session(logoutCsrf.session())
                        .cookie(logoutCsrf.cookie())
                        .header(logoutCsrf.headerName(), logoutCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void rateLimitsLoginFailuresAndIncludesRetryAfter() throws Exception {
        createAccount("limited-login@example.com", PASSWORD);
        String address = "198.51.100.60";

        for (int attempt = 0; attempt < 5; attempt++) {
            login("limited-login@example.com", "incorrect-password", address)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }

        login("limited-login@example.com", PASSWORD, address)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", org.hamcrest.Matchers.matchesPattern("[1-9][0-9]*")))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void successfulLoginClearsPriorFailureCount() throws Exception {
        createAccount("reset-login@example.com", PASSWORD);
        String address = "198.51.100.61";

        for (int attempt = 0; attempt < 4; attempt++) {
            login("reset-login@example.com", "incorrect-password", address)
                    .andExpect(status().isUnauthorized());
        }
        login("reset-login@example.com", PASSWORD, address)
                .andExpect(status().isOk());
        for (int attempt = 0; attempt < 4; attempt++) {
            login("reset-login@example.com", "incorrect-password", address)
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void rateLimitsRegistrationAndIncludesRetryAfter() throws Exception {
        String address = "198.51.100.70";
        for (int attempt = 0; attempt < 5; attempt++) {
            register("limited-register-" + attempt + "@example.com", address)
                    .andExpect(status().isCreated());
        }

        register("limited-register-final@example.com", address)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", org.hamcrest.Matchers.matchesPattern("[1-9][0-9]*")))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    private Account createAccount(String email, String password) {
        return accounts.saveAndFlush(new Account(
                UUID.randomUUID(),
                email,
                passwordEncoder.encode(password),
                time.now()));
    }

    private org.springframework.test.web.servlet.ResultActions login(
            String email,
            String password,
            String address) throws Exception {
        CsrfExchange csrf = csrf(new MockHttpSession());
        return mockMvc.perform(post("/api/v1/auth/login")
                .session(csrf.session())
                .cookie(csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .with(remoteAddress(address))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions register(
            String email,
            String address) throws Exception {
        CsrfExchange csrf = csrf(new MockHttpSession());
        return mockMvc.perform(post("/api/v1/auth/register")
                .session(csrf.session())
                .cookie(csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .with(remoteAddress(address))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"));
    }

    private CsrfExchange csrf(MockHttpSession session) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/csrf").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andReturn();
        String body = result.getResponse().getContentAsString();
        return new CsrfExchange(
                session,
                result.getResponse().getCookie("XSRF-TOKEN"),
                JsonPath.read(body, "$.headerName"),
                JsonPath.read(body, "$.token"));
    }

    private RequestPostProcessor remoteAddress(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private record CsrfExchange(
            MockHttpSession session,
            Cookie cookie,
            String headerName,
            String token) {
    }
}
