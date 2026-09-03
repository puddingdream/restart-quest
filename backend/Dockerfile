FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /workspace
COPY gradle ./gradle
COPY gradlew build.gradle settings.gradle ./
RUN sed -i 's/\r$//' gradlew \
    && chmod 0755 gradlew
COPY src ./src
RUN ./gradlew --no-daemon clean bootJar \
    && jar_path="$(find build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' -print -quit)" \
    && test -n "$jar_path" \
    && cp "$jar_path" /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache curl \
    && addgroup -S restartquest \
    && adduser -S -G restartquest restartquest
WORKDIR /app
COPY --from=build --chown=restartquest:restartquest /workspace/app.jar ./app.jar

USER restartquest
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
