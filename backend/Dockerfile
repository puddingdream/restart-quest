FROM eclipse-temurin:21.0.7_6-jdk-alpine-3.21@sha256:8e26f8064f2b89bc8543faf43ded3f223f47dd0a7afca042fdc892f1f6a4a8c3 AS build

WORKDIR /workspace

COPY gradle gradle
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN chmod +x gradlew \
    && ./gradlew --no-daemon dependencies

COPY src src
RUN ./gradlew --no-daemon clean bootJar

FROM eclipse-temurin:21.0.7_6-jre-alpine-3.21@sha256:7b5c88eb4182a92aab3a4b10550061a6e18639bf176e7ebca21f866b19f853c1 AS runtime

RUN addgroup -S restartquest \
    && adduser -S -G restartquest restartquest

WORKDIR /app
COPY --from=build --chown=restartquest:restartquest /workspace/build/libs/*.jar /app/restart-quest.jar

USER restartquest
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/restart-quest.jar"]
