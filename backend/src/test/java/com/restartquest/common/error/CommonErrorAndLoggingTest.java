package com.restartquest.common.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.jayway.jsonpath.JsonPath;
import com.restartquest.common.logging.TraceLoggingFilter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class CommonErrorAndLoggingTest {

    private final Logger rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    private final ListAppender<ILoggingEvent> logAppender = new ListAppender<>();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        logAppender.start();
        rootLogger.addAppender(logAppender);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new TestController())
                .setControllerAdvice(new ApiExceptionHandler())
                .addFilters(new TraceLoggingFilter())
                .build();
    }

    @AfterEach
    void tearDown() {
        rootLogger.detachAppender(logAppender);
        logAppender.stop();
    }

    @Test
    void returnsTraceIdWithoutEchoingSensitiveRequestValues() throws Exception {
        String requestBody = """
                {
                  "email": "private@example.com",
                  "password": "short",
                  "note": "private memo"
                }
                """;

        MvcResult result = mockMvc.perform(post("/test/validate")
                        .queryParam("email", "private@example.com")
                        .header("Cookie", "SESSION=private-cookie")
                        .header("X-CSRF-TOKEN", "private-csrf-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(header().exists(TraceId.RESPONSE_HEADER))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("입력값을 확인해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.password").value("입력값을 확인해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.note").value("입력값을 확인해 주세요."))
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        String traceId = JsonPath.read(body, "$.traceId");
        assertThat(result.getResponse().getHeader(TraceId.RESPONSE_HEADER)).isEqualTo(traceId);
        assertThat(body)
                .doesNotContain("private@example.com")
                .doesNotContain("short")
                .doesNotContain("private memo")
                .doesNotContain("private-cookie")
                .doesNotContain("private-csrf-token");

        assertNoSensitiveValues(renderedLogs());
    }

    @Test
    void convertsUnexpectedExceptionsToSafeErrors() throws Exception {
        MvcResult result = mockMvc.perform(post("/test/failure")
                        .queryParam("email", "private@example.com")
                        .header("Cookie", "SESSION=private-cookie")
                        .header("X-CSRF-TOKEN", "private-csrf-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"private-password\",\"note\":\"private memo\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(header().exists(TraceId.RESPONSE_HEADER))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andReturn();

        assertNoSensitiveValues(result.getResponse().getContentAsString());
        assertNoSensitiveValues(renderedLogs());
    }

    private List<String> renderedLogs() {
        return logAppender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    private void assertNoSensitiveValues(String text) {
        assertThat(text)
                .doesNotContain("private@example.com")
                .doesNotContain("private-password")
                .doesNotContain("private memo")
                .doesNotContain("private-cookie")
                .doesNotContain("private-csrf-token");
    }

    private void assertNoSensitiveValues(List<String> logs) {
        assertNoSensitiveValues(String.join("\n", logs));
        assertThat(logs).anySatisfy(message -> assertThat(message)
                .contains("traceId=")
                .contains("resultCode=")
                .contains("durationMs="));
    }

    @RestController
    static class TestController {

        @PostMapping("/test/validate")
        void validate(@Valid @RequestBody SensitiveRequest request) {
        }

        @PostMapping("/test/failure")
        void fail() {
            throw new IllegalStateException("private@example.com private-password private memo");
        }
    }

    record SensitiveRequest(
            @NotBlank String email,
            @Size(min = 10, max = 72) String password,
            @Size(max = 3) String note) {
    }
}
