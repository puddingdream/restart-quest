package com.restartquest.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.restartquest.application.port.AccessTokenStore;
import com.restartquest.application.port.PasswordHasher;
import com.restartquest.application.port.UserStore;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UserContextApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserStore userStore;

    @Autowired
    private PasswordHasher passwordHasher;

    @Autowired
    private AccessTokenStore accessTokenStore;

    @Test
    void signupLoginAndMeFollowCanonicalContractWithoutCredentialLeakage() throws Exception {
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("  MEMBER@Example.com  ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.user.email").value("member@example.com"))
                .andExpect(jsonPath("$.user.name").value("테스트 사용자"))
                .andExpect(jsonPath("$.user.onboardingCompleted").value(false))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.accessToken").doesNotExist())
                .andReturn();

        String accessToken = accessToken(signup);
        var savedUser = userStore.findByEmail("member@example.com").orElseThrow();
        assertThat(savedUser.getPasswordHash()).isNotEqualTo("password123!");
        assertThat(passwordHasher.matches("password123!", savedUser.getPasswordHash())).isTrue();
        assertThat(accessTokenStore.findByTokenHash(sha256(accessToken)))
                .hasValueSatisfying(stored -> assertThat(stored.getTokenHash()).isNotEqualTo(accessToken));

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("member@example.com"))
                .andExpect(jsonPath("$.onboardingCompleted").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.accessToken").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"member@example.com","password":"password123!"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.user.email").value("member@example.com"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"member@example.com","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void rejectsDuplicateEmailInvalidSignupAndUnauthenticatedAccess() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("duplicate@example.com")))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("DUPLICATE@example.com")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","password":"short","name":"A"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(3));

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(get("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void rejectsPasswordOverBcryptByteLimit() throws Exception {
        String multibytePassword = "가".repeat(25);
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"long-password@example.com","password":"%s","name":"테스트 사용자"}
                                """.formatted(multibytePassword)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void logoutReturnsNoContentAndRevokesCurrentAccessToken() throws Exception {
        String accessToken = signupAndGetToken("logout@example.com");
        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void onboardingUpsertAndReadKeepCompletedFlagConsistent() throws Exception {
        String accessToken = signupAndGetToken("onboarding@example.com");

        mockMvc.perform(get("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ONBOARDING_NOT_FOUND"));

        mockMvc.perform(put("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validOnboardingJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.profile.desiredJob").value("백엔드 개발자"))
                .andExpect(jsonPath("$.profile.desiredWorkType").value("FULL_TIME"))
                .andExpect(jsonPath("$.profile.interviewExperience").value("LIMITED"));

        mockMvc.perform(get("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.profile.careerGapMonths").value(8));

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true));

        mockMvc.perform(put("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "desiredJob":"서버 개발자",
                                  "region":"부산",
                                  "desiredWorkType":"ANY",
                                  "careerGapMonths":9,
                                  "hasResume":false,
                                  "interviewExperience":"EXPERIENCED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.profile.desiredJob").value("서버 개발자"));
    }

    @Test
    void onboardingValidatesLengthsRangesRequiredValuesAndEnums() throws Exception {
        String accessToken = signupAndGetToken("validation@example.com");
        String longText = "가".repeat(81);

        mockMvc.perform(put("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "desiredJob":"%s",
                                  "region":"%s",
                                  "desiredWorkType":null,
                                  "careerGapMonths":601,
                                  "hasResume":null,
                                  "interviewExperience":null
                                }
                                """.formatted(longText, longText)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(6));

        mockMvc.perform(put("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "desiredJob":"백엔드 개발자",
                                  "region":"서울",
                                  "desiredWorkType":"REMOTE_ONLY",
                                  "careerGapMonths":8,
                                  "hasResume":true,
                                  "interviewExperience":"LIMITED"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("desiredWorkType"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value("지원하지 않는 값이 포함되어 있습니다."));

        mockMvc.perform(put("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "desiredJob":" A ",
                                  "region":"서울",
                                  "desiredWorkType":"FULL_TIME",
                                  "careerGapMonths":8,
                                  "hasResume":true,
                                  "interviewExperience":"LIMITED"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("desiredJob"));

        mockMvc.perform(get("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(false));
    }

    private String signupAndGetToken(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return accessToken(result);
    }

    private static String accessToken(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private static String signupJson(String email) {
        return """
                {"email":"%s","password":"password123!","name":"테스트 사용자"}
                """.formatted(email);
    }

    private static String validOnboardingJson() {
        return """
                {
                  "desiredJob":"백엔드 개발자",
                  "region":"서울",
                  "desiredWorkType":"FULL_TIME",
                  "careerGapMonths":8,
                  "hasResume":true,
                  "interviewExperience":"LIMITED"
                }
                """;
    }

    private static String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }

    private static String sha256(String value) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
