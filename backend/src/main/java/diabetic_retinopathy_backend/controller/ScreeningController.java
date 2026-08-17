package diabetic_retinopathy_backend.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import diabetic_retinopathy_backend.client.AiServiceClient;
import diabetic_retinopathy_backend.dto.AiPredictionResponse;
import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.Screening;
import diabetic_retinopathy_backend.repository.PatientRepository;
import diabetic_retinopathy_backend.repository.ScreeningRepository;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/screenings")
public class ScreeningController {

    private final AiServiceClient aiServiceClient;
    private final ScreeningRepository screeningRepository;
    private final PatientRepository patientRepository;

    public ScreeningController(
            AiServiceClient aiServiceClient,
            ScreeningRepository screeningRepository,
            PatientRepository patientRepository) {

        this.aiServiceClient = aiServiceClient;
        this.screeningRepository = screeningRepository;
        this.patientRepository = patientRepository;
    }

    @PostMapping(
            value = "/analyze",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public Screening analyze(
            @RequestParam("patientId") String patientId,
            @RequestParam("file") MultipartFile file,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole
    ) throws Exception {

        // Only patients can start their own screening.
        if (!"PATIENT".equals(userRole)) {
            throw new RuntimeException(
                    "Only patients can start a screening."
            );
        }

        // Find the patient profile.
        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Patient not found."
                        )
                );

        // Make sure this patient belongs to
        // the currently logged-in account.
        if (!userId.equals(patient.getUserId())) {
            throw new RuntimeException(
                    "You are not authorized to screen this patient."
            );
        }

        // Send image to Python AI service.
        AiPredictionResponse aiResponse =
                aiServiceClient.predict(file);

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

        return screeningRepository.save(screening);
    }

    @GetMapping("/patient/{patientId}")
    public List<Screening> getPatientScreenings(
            @PathVariable String patientId,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Patient not found."
                        )
                );

        // Doctors can view patient screening history.
        if ("DOCTOR".equals(userRole)) {
            return screeningRepository
                    .findByPatientId(patientId);
        }

        // Patients can only view their own history.
        if (!userId.equals(patient.getUserId())) {
            throw new RuntimeException(
                    "You are not authorized to view this patient's history."
            );
        }

        return screeningRepository
                .findByPatientId(patientId);
    }
}