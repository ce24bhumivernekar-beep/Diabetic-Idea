package diabetic_retinopathy_backend.client;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.multipart.MultipartFile;

import diabetic_retinopathy_backend.dto.AiPredictionResponse;
import diabetic_retinopathy_backend.exception.AiServiceException;

/**
 * Calls the Python FastAPI service that runs the EfficientNetB0 model
 * and produces the Grad-CAM heatmap.
 */
@Service
public class AiServiceClient {

    private static final Logger log =
            LoggerFactory.getLogger(AiServiceClient.class);

    private final RestClient restClient;
    private final String baseUrl;

    public AiServiceClient(
            @Value("${ai.service.base-url}") String baseUrl,
            @Value("${ai.service.timeout-seconds}") int timeoutSeconds) {

        this.baseUrl = baseUrl;

        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();

        requestFactory.setConnectTimeout(
                Duration.ofSeconds(10)
        );

        // Model inference plus Grad-CAM can take a while on CPU.
        requestFactory.setReadTimeout(
                Duration.ofSeconds(timeoutSeconds)
        );

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();

        log.info("AI service base URL: {}", baseUrl);
    }

    /**
     * @return the AI service health payload, or null when it is unreachable.
     */
    public boolean isReachable() {

        try {

            restClient.get()
                    .uri("/health")
                    .retrieve()
                    .toBodilessEntity();

            return true;

        } catch (Exception error) {

            log.warn(
                    "AI service at {} is not reachable: {}",
                    baseUrl,
                    error.getMessage()
            );

            return false;
        }
    }

    public AiPredictionResponse predict(
            MultipartFile file) {

        ByteArrayResource resource;

        try {

            resource = new ByteArrayResource(file.getBytes()) {

                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };

        } catch (Exception error) {

            throw new AiServiceException(
                    "Could not read the uploaded image.",
                    error
            );
        }

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", resource);

        try {

            return restClient.post()
                    .uri("/predict")
                    .contentType(
                            MediaType.MULTIPART_FORM_DATA
                    )
                    .body(body)
                    .retrieve()
                    .body(AiPredictionResponse.class);

        } catch (RestClientResponseException error) {

            // The AI service answered with 4xx / 5xx - pass its reason on.
            throw new AiServiceException(
                    "AI service rejected the image: "
                            + error.getResponseBodyAsString(),
                    error
            );

        } catch (ResourceAccessException error) {

            throw new AiServiceException(
                    "AI service is not running at "
                            + baseUrl
                            + ". Start it with: uvicorn app:app --port 8000",
                    error
            );
        }
    }
}
