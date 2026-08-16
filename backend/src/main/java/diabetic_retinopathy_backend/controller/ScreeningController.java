package diabetic_retinopathy_backend.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import diabetic_retinopathy_backend.client.AiServiceClient;
import diabetic_retinopathy_backend.dto.AiPredictionResponse;
import diabetic_retinopathy_backend.model.Screening;
import diabetic_retinopathy_backend.repository.ScreeningRepository;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/screenings")
public class ScreeningController {

    private final AiServiceClient aiServiceClient;
    private final ScreeningRepository screeningRepository;

    public ScreeningController(
            AiServiceClient aiServiceClient,
            ScreeningRepository screeningRepository) {

        this.aiServiceClient = aiServiceClient;
        this.screeningRepository = screeningRepository;
    }

    @PostMapping(
            value = "/analyze",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public Screening analyze(
            @RequestParam("patientId") String patientId,
            @RequestParam("file") MultipartFile file
    ) throws Exception {

        // Send image to Python AI service
        AiPredictionResponse aiResponse =
                aiServiceClient.predict(file);

        // Create screening record
        Screening screening = new Screening();

        screening.setPatientId(patientId);

        screening.setOriginalImagePath(
                aiResponse.getOriginalImage()
        );

        screening.setHeatmapPath(
                aiResponse.getHeatmap()
        );

        screening.setOverlayPath(
                aiResponse.getOverlay()
        );

        screening.setPrediction(
                aiResponse.getPrediction()
        );

        screening.setClassId(
                aiResponse.getClassId()
        );

        screening.setConfidence(
                aiResponse.getConfidence()
        );

        screening.setStatus("COMPLETED");

        screening.setCreatedAt(
                LocalDateTime.now()
        );

        // Save result in MongoDB
        return screeningRepository.save(screening);
    }

    @GetMapping("/patient/{patientId}")
    public List<Screening> getPatientScreenings(
            @PathVariable String patientId) {

        return screeningRepository.findByPatientId(patientId);
    }
}