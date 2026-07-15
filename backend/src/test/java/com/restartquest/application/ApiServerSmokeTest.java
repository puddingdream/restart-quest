package com.restartquest.application;

import com.restartquest.presentation.ApiServer;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ApiServerSmokeTest {
    private static final Pattern QUEST_ID_PATTERN = Pattern.compile("\"id\":\"([^\"]+)\"");

    private ApiServerSmokeTest() {
    }

    public static void main(String[] args) throws Exception {
        ApiServer server = ApiServer.createWithDefaults(0);
        server.start();
        try {
            HttpClient client = HttpClient.newHttpClient();
            String baseUrl = "http://localhost:" + server.port();

            String onboardingBody = """
                    {
                      "region": "Seoul",
                      "desiredJob": "Backend Developer",
                      "desiredWorkType": "Remote",
                      "careerGapMonths": 8,
                      "hasResume": true,
                      "hasInterviewExperience": false,
                      "interests": ["Java", "Spring"],
                      "energyLevel": "LOW"
                    }
                    """;
            assertStatus(201, send(client, "POST", baseUrl + "/api/onboarding", onboardingBody));

            HttpResponse<String> generateResponse = send(client, "POST", baseUrl + "/api/quests/generate", "");
            assertStatus(201, generateResponse);
            String firstQuestId = questIdAt(generateResponse.body(), 0);
            String secondQuestId = questIdAt(generateResponse.body(), 1);

            assertStatus(200, send(client, "PATCH", baseUrl + "/api/quests/" + firstQuestId + "/complete", ""));
            assertStatus(
                    200,
                    send(
                            client,
                            "PATCH",
                            baseUrl + "/api/quests/" + secondQuestId + "/fail",
                            "{\"failureReason\":\"NOT_SURE_WHAT_TO_WRITE\",\"note\":\"Need starter\"}"
                    )
            );
            assertStatus(
                    201,
                    send(
                            client,
                            "POST",
                            baseUrl + "/api/quests/" + secondQuestId + "/redesign",
                            "{\"failureReason\":\"NOT_SURE_WHAT_TO_WRITE\"}"
                    )
            );

            HttpResponse<String> dashboardResponse = send(client, "GET", baseUrl + "/api/dashboard", "");
            assertStatus(200, dashboardResponse);
            assertContains(dashboardResponse.body(), "\"doneCount\":1", "dashboard done count");
            assertContains(dashboardResponse.body(), "\"failedCount\":1", "dashboard failed count");
            assertContains(dashboardResponse.body(), "\"redesignedCount\":3", "dashboard redesigned count");
            assertContains(dashboardResponse.body(), "\"nextAction\":{", "dashboard next action");

            System.out.println("ApiServerSmokeTest passed");
        } finally {
            server.stop();
        }
    }

    private static HttpResponse<String> send(
            HttpClient client,
            String method,
            String url,
            String body
    ) throws Exception {
        HttpRequest.BodyPublisher publisher = body == null || body.isBlank()
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .method(method, publisher)
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static String questIdAt(String json, int index) {
        Matcher matcher = QUEST_ID_PATTERN.matcher(json);
        for (int current = 0; matcher.find(); current++) {
            if (current == index) {
                return matcher.group(1);
            }
        }
        throw new AssertionError("Quest id not found at index " + index);
    }

    private static void assertStatus(int expected, HttpResponse<String> response) {
        if (response.statusCode() != expected) {
            throw new AssertionError(
                    "Expected status " + expected + " but was " + response.statusCode() + ": " + response.body()
            );
        }
    }

    private static void assertContains(String text, String expected, String message) {
        if (!text.contains(expected)) {
            throw new AssertionError(message + " missing <" + expected + "> in " + text);
        }
    }
}
