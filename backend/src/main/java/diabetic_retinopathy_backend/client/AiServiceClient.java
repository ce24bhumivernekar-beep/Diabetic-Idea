package diabetic_retinopathy_backend.client;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import diabetic_retinopathy_backend.dto.AiPredictionResponse;

@Service
public class AiServiceClient {

    private final RestClient restClient;

    public AiServiceClient() {

        this.restClient = RestClient.builder()
                .baseUrl("http://localhost:8000")
                .build();
    }

    public AiPredictionResponse predict(
            MultipartFile file) throws Exception {

        ByteArrayResource resource =
                new ByteArrayResource(file.getBytes()) {

                    @Override
                    public String getFilename() {
                        return file.getOriginalFilename();
                    }
                };

        MultiValueMap<String, Object> body =
                new LinkedMultiValueMap<>();

        body.add("file", resource);

        return restClient.post()
                .uri("/predict")
                .contentType(
                        MediaType.MULTIPART_FORM_DATA
                )
                .body(body)
                .retrieve()
                .body(AiPredictionResponse.class);
    }
}