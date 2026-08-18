# Spring Boot API - multi-stage so the runtime image carries no build tools.
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /build

COPY pom.xml .

# Cached layer: dependencies change far less often than source.
RUN mvn -q -B dependency:go-offline

COPY src ./src

RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=build /build/target/*.jar app.jar

ENV PORT=8080

EXPOSE 8080

# Container-aware heap sizing; free tiers are memory capped.
CMD ["sh", "-c", "java -XX:MaxRAMPercentage=75 -jar app.jar --server.port=${PORT}"]
