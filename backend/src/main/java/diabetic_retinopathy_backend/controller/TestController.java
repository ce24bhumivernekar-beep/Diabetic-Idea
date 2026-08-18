package diabetic_retinopathy_backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.client.AiServiceClient;

/**
 * Public health endpoint. Reports the whole pipeline in one call, so a broken
 * link (Mongo down, AI service not started) is visible immediately.
 */
@RestController
public class TestController {

    private final MongoTemplate mongoTemplate;
    private final AiServiceClient aiServiceClient;

    public TestController(
            MongoTemplate mongoTemplate,
            AiServiceClient aiServiceClient) {

        this.mongoTemplate = mongoTemplate;
        this.aiServiceClient = aiServiceClient;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {

        Map<String, Object> status = new LinkedHashMap<>();

        status.put("backend", "UP");
        status.put("mongodb", mongoStatus());
        status.put(
                "aiService",
                aiServiceClient.isReachable() ? "UP" : "DOWN"
        );

        return status;
    }

    private String mongoStatus() {

        try {

            mongoTemplate.getDb()
                    .runCommand(new Document("ping", 1));

            return "UP";

        } catch (Exception error) {

            return "DOWN";
        }
    }
}
