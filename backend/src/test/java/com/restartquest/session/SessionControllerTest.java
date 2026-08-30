package com.restartquest.session;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.restartquest.config.SessionProperties;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class SessionControllerTest {

    @Mock
    private SessionService sessionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        SessionProperties properties = new SessionProperties();
        properties.setTtl(Duration.ofDays(30));
        mockMvc = mockMvcFor(properties);
    }

    @Test
    void newSessionReturns201AndContractCookieAttributes() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(sessionService.start(isNull())).thenReturn(new SessionService.SessionStart(
                sessionId, "new-token", Instant.parse("2026-09-30T00:00:00Z"), true));

        mockMvc.perform(post("/api/v1/session"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("rq_session=new-token"),
                        org.hamcrest.Matchers.containsString("Path=/"),
                        org.hamcrest.Matchers.containsString("Max-Age=2592000"),
                        org.hamcrest.Matchers.containsString("HttpOnly"),
                        org.hamcrest.Matchers.containsString("SameSite=Lax"))))
                .andExpect(jsonPath("$.expiresAt").value("2026-09-30T00:00:00Z"));
    }

    @Test
    void existingSessionReturns200AndRefreshesSameCookie() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(sessionService.start("existing-token")).thenReturn(new SessionService.SessionStart(
                sessionId, "existing-token", Instant.parse("2026-09-30T00:00:00Z"), false));

        mockMvc.perform(post("/api/v1/session").cookie(new Cookie("rq_session", "existing-token")))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString(
                        "rq_session=existing-token")))
                .andExpect(jsonPath("$.expiresAt").value("2026-09-30T00:00:00Z"));

        verify(sessionService).start("existing-token");
    }

    @Test
    void secureCookieIsForcedWhenProductionPropertyIsEnabled() throws Exception {
        SessionProperties productionProperties = new SessionProperties();
        productionProperties.setCookieSecure(true);
        MockMvc productionMockMvc = mockMvcFor(productionProperties);
        when(sessionService.start(isNull())).thenReturn(new SessionService.SessionStart(
                UUID.randomUUID(),
                "production-token",
                Instant.parse("2026-09-30T00:00:00Z"),
                true));

        productionMockMvc.perform(post("/api/v1/session"))
                .andExpect(status().isCreated())
                .andExpect(header().string(
                        "Set-Cookie", org.hamcrest.Matchers.containsString("Secure")));
    }

    private MockMvc mockMvcFor(SessionProperties properties) {
        var objectMapper = Jackson2ObjectMapperBuilder.json()
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        var converter = new MappingJackson2HttpMessageConverter(objectMapper);
        return MockMvcBuilders.standaloneSetup(new SessionController(sessionService, properties))
                .setMessageConverters(converter)
                .build();
    }
}
