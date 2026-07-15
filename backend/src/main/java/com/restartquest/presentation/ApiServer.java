package com.restartquest.presentation;

import com.restartquest.application.CompleteQuestService;
import com.restartquest.application.FailQuestService;
import com.restartquest.application.GenerateDailyQuestService;
import com.restartquest.application.GetDashboardService;
import com.restartquest.application.InMemoryRestartQuestStore;
import com.restartquest.application.OnboardingService;
import com.restartquest.application.RedesignQuestService;
import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.EnergyLevel;
import com.restartquest.domain.FailureReason;
import com.restartquest.domain.OnboardingProfile;
import com.restartquest.infrastructure.MockQuestAiClient;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

public final class ApiServer {
    private static final String PROFILE_ID = "demo-user";

    private final HttpServer httpServer;
    private final InMemoryRestartQuestStore store;
    private final OnboardingService onboardingService;
    private final GenerateDailyQuestService generateDailyQuestService;
    private final CompleteQuestService completeQuestService;
    private final FailQuestService failQuestService;
    private final RedesignQuestService redesignQuestService;
    private final GetDashboardService getDashboardService;

    private ApiServer(
            HttpServer httpServer,
            InMemoryRestartQuestStore store,
            OnboardingService onboardingService,
            GenerateDailyQuestService generateDailyQuestService,
            CompleteQuestService completeQuestService,
            FailQuestService failQuestService,
            RedesignQuestService redesignQuestService,
            GetDashboardService getDashboardService
    ) {
        this.httpServer = httpServer;
        this.store = store;
        this.onboardingService = onboardingService;
        this.generateDailyQuestService = generateDailyQuestService;
        this.completeQuestService = completeQuestService;
        this.failQuestService = failQuestService;
        this.redesignQuestService = redesignQuestService;
        this.getDashboardService = getDashboardService;
    }

    public static ApiServer createWithDefaults(int port) throws IOException {
        InMemoryRestartQuestStore store = new InMemoryRestartQuestStore();
        MockQuestAiClient questAiClient = new MockQuestAiClient();
        HttpServer httpServer = HttpServer.create(new InetSocketAddress(port), 0);
        ApiServer apiServer = new ApiServer(
                httpServer,
                store,
                new OnboardingService(store),
                new GenerateDailyQuestService(store, questAiClient),
                new CompleteQuestService(store),
                new FailQuestService(store),
                new RedesignQuestService(store, questAiClient),
                new GetDashboardService(store)
        );
        httpServer.createContext("/api", apiServer::handle);
        return apiServer;
    }

    public void start() {
        httpServer.start();
    }

    public void stop() {
        httpServer.stop(0);
    }

    public int port() {
        return httpServer.getAddress().getPort();
    }

    private void handle(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        try {
            route(exchange);
        } catch (NoSuchElementException exception) {
            writeJson(exchange, 404, JsonResponses.error(exception.getMessage()));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            writeJson(exchange, 400, JsonResponses.error(exception.getMessage()));
        } catch (RuntimeException exception) {
            writeJson(exchange, 500, JsonResponses.error("Unexpected backend error"));
        }
    }

    private void route(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();

        if ("POST".equals(method) && "/api/onboarding".equals(path)) {
            OnboardingProfile profile = createProfile(readObject(exchange));
            writeJson(exchange, 201, JsonResponses.profile(onboardingService.save(profile)));
            return;
        }
        if ("GET".equals(method) && "/api/onboarding/me".equals(path)) {
            writeJson(exchange, 200, JsonResponses.profile(onboardingService.getCurrent()));
            return;
        }
        if ("POST".equals(method) && "/api/quests/generate".equals(path)) {
            writeJson(exchange, 201, JsonResponses.generatedQuests(generateDailyQuestService.generateForToday()));
            return;
        }
        if ("GET".equals(method) && "/api/quests/today".equals(path)) {
            writeJson(exchange, 200, JsonResponses.todayQuests(store.findTodayQuests()));
            return;
        }
        if ("PATCH".equals(method) && path.startsWith("/api/quests/") && path.endsWith("/complete")) {
            String questId = extractQuestId(path, "/complete");
            writeJson(exchange, 200, JsonResponses.quest(completeQuestService.complete(questId)));
            return;
        }
        if ("PATCH".equals(method) && path.startsWith("/api/quests/") && path.endsWith("/fail")) {
            String questId = extractQuestId(path, "/fail");
            Map<String, Object> body = readObject(exchange);
            DailyQuest failedQuest = failQuestService.fail(
                    questId,
                    requiredEnum(body, "failureReason", FailureReason.class),
                    optionalString(body, "note")
            );
            writeJson(exchange, 200, JsonResponses.quest(failedQuest));
            return;
        }
        if ("POST".equals(method) && path.startsWith("/api/quests/") && path.endsWith("/redesign")) {
            String questId = extractQuestId(path, "/redesign");
            Map<String, Object> body = readObject(exchange);
            writeJson(
                    exchange,
                    201,
                    JsonResponses.redesignResult(redesignQuestService.redesign(
                            questId,
                            requiredEnum(body, "failureReason", FailureReason.class)
                    ))
            );
            return;
        }
        if ("GET".equals(method) && "/api/dashboard".equals(path)) {
            writeJson(exchange, 200, JsonResponses.dashboard(getDashboardService.getTodaySummary()));
            return;
        }

        throw new NoSuchElementException("Endpoint not found: " + method + " " + path);
    }

    private OnboardingProfile createProfile(Map<String, Object> body) {
        return new OnboardingProfile(
                PROFILE_ID,
                requiredString(body, "region"),
                requiredString(body, "desiredJob"),
                requiredString(body, "desiredWorkType"),
                requiredInt(body, "careerGapMonths"),
                requiredBoolean(body, "hasResume"),
                requiredBoolean(body, "hasInterviewExperience"),
                optionalStringList(body, "interests"),
                requiredEnum(body, "energyLevel", EnergyLevel.class)
        );
    }

    private static Map<String, Object> readObject(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        return SimpleJson.parseObject(body);
    }

    private static String extractQuestId(String path, String suffix) {
        String encoded = path.substring("/api/quests/".length(), path.length() - suffix.length());
        if (encoded.isBlank()) {
            throw new IllegalArgumentException("quest id is required");
        }
        return URLDecoder.decode(encoded, StandardCharsets.UTF_8);
    }

    private static String requiredString(Map<String, Object> body, String fieldName) {
        Object value = body.get(fieldName);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return text;
    }

    private static String optionalString(Map<String, Object> body, String fieldName) {
        Object value = body.get(fieldName);
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException(fieldName + " must be a string");
        }
        return text;
    }

    private static int requiredInt(Map<String, Object> body, String fieldName) {
        Object value = body.get(fieldName);
        if (value instanceof Integer number) {
            return number;
        }
        throw new IllegalArgumentException(fieldName + " must be an integer");
    }

    private static boolean requiredBoolean(Map<String, Object> body, String fieldName) {
        Object value = body.get(fieldName);
        if (value instanceof Boolean bool) {
            return bool;
        }
        throw new IllegalArgumentException(fieldName + " must be a boolean");
    }

    private static List<String> optionalStringList(Map<String, Object> body, String fieldName) {
        Object value = body.get(fieldName);
        if (value == null) {
            return List.of();
        }
        if (!(value instanceof List<?> rawValues)) {
            throw new IllegalArgumentException(fieldName + " must be an array");
        }
        return rawValues.stream()
                .map(raw -> {
                    if (!(raw instanceof String text)) {
                        throw new IllegalArgumentException(fieldName + " must contain only strings");
                    }
                    return text;
                })
                .toList();
    }

    private static <T extends Enum<T>> T requiredEnum(
            Map<String, Object> body,
            String fieldName,
            Class<T> enumType
    ) {
        String value = requiredString(body, fieldName);
        try {
            return Enum.valueOf(enumType, value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(fieldName + " has unsupported value: " + value);
        }
    }

    private static void writeJson(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] response = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }
}
