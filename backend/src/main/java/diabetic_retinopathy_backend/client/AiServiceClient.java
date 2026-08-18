package diabetic_retinopathy_backend.client;

import java.time.Duration;
import java.util.List;
import java.util.Map;

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
    private final RestClient liveClient;
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

        SimpleClientHttpRequestFactory liveFactory =
                new SimpleClientHttpRequestFactory();

        liveFactory.setConnectTimeout(Duration.ofSeconds(2));
        liveFactory.setReadTimeout(Duration.ofSeconds(8));

        this.liveClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(liveFactory)
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

    /**
     * Viewfinder path: prediction only, nothing saved. Called several times a
     * second while the camera is running, so it uses a short timeout - a slow
     * frame should be dropped, not queued.
     */
    public AiPredictionResponse predictLive(
            MultipartFile file,
            boolean withHeatmap) {

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", asResource(file));
        body.add("heatmap", String.valueOf(withHeatmap));

        try {

            return liveClient.post()
                    .uri("/predict/live")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(AiPredictionResponse.class);

        } catch (RestClientResponseException error) {

            throw new AiServiceException(
                    "AI service rejected the frame: "
                            + error.getResponseBodyAsString(),
                    error
            );

        } catch (ResourceAccessException error) {

            throw new AiServiceException(
                    "AI service is not reachable at " + baseUrl + ".",
                    error
            );
        }
    }

    // ---------------------------------------------------------
    // Camera-only triage measurements
    // ---------------------------------------------------------

    @SuppressWarnings("unchecked")
    public Map<String, Object> analysePpg(Map<String, Object> payload) {

        return callForMap(() -> restClient.post()
                .uri("/triage/ppg")
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(Map.class));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analysePlr(
            List<MultipartFile> frames,
            String timestampsMs,
            int lightOnIndex) {

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        for (MultipartFile frame : frames) {
            body.add("frames", asResource(frame));
        }

        body.add("timestampsMs", timestampsMs);
        body.add("lightOnIndex", String.valueOf(lightOnIndex));

        return callForMap(() -> restClient.post()
                .uri("/triage/plr")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(Map.class));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analysePallor(
            MultipartFile file,
            String conjunctivaBox,
            String scleraBox) {

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", asResource(file));
        body.add("conjunctivaBox", conjunctivaBox);
        body.add("scleraBox", scleraBox);

        return callForMap(() -> restClient.post()
                .uri("/triage/pallor")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(Map.class));
    }

    /**
     * The AI service explains its own refusals ("cover the lens fully"), so
     * its message is passed through rather than replaced.
     */
    private Map<String, Object> callForMap(
            java.util.function.Supplier<Map<String, Object>> call) {

        try {

            return call.get();

        } catch (RestClientResponseException error) {

            throw new AiServiceException(
                    error.getResponseBodyAsString(),
                    error
            );

        } catch (ResourceAccessException error) {

            throw new AiServiceException(
                    "AI service is not reachable at " + baseUrl + ".",
                    error
            );
        }
    }

    private ByteArrayResource asResource(MultipartFile file) {

        try {

            return new ByteArrayResource(file.getBytes()) {

                @Override
                public String getFilename() {
                    return file.getOriginalFilename() == null
                            ? "frame.jpg"
                            : file.getOriginalFilename();
                }
            };

        } catch (Exception error) {

            throw new AiServiceException(
                    "Could not read the uploaded image.",
                    error
            );
        }
    }

    public AiPredictionResponse predict(
            MultipartFile file) {

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", asResource(file));

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
