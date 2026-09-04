FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /workspace/backend
COPY gradlew gradlew.bat build.gradle settings.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
RUN ./gradlew --no-daemon clean bootJar

FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache curl \
    && addgroup -S app \
    && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /workspace/backend/build/libs/restart-quest-backend-0.1.0.jar ./app.jar
COPY --from=deploy --chown=app:app backend-entrypoint.sh ./backend-entrypoint.sh
RUN chmod 0555 ./backend-entrypoint.sh

USER app
EXPOSE 8080
ENTRYPOINT ["/app/backend-entrypoint.sh"]
