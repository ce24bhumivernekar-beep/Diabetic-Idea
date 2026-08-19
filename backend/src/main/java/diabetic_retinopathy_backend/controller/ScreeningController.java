package diabetic_retinopathy_backend.controller;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.util.concurrent.TimeUnit;

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
import diabetic_retinopathy_backend.exception.ApiException;
import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.Screening;
import diabetic_retinopathy_backend.repository.PatientRepository;
import diabetic_retinopathy_backend.repository.ScreeningRepository;
import diabetic_retinopathy_backend.service.ScreeningEventService;

@RestController
@RequestMapping("/api/screenings")
public class ScreeningController {

    private final AiServiceClient aiServiceClient;
    private final ScreeningRepository screeningRepository;
    private final PatientRepository patientRepository;
    private final ScreeningEventService events;

    public ScreeningController(
            AiServiceClient aiServiceClient,
            ScreeningRepository screeningRepository,
            PatientRepository patientRepository,
            ScreeningEventService events) {

        this.aiServiceClient = aiServiceClient;
        this.screeningRepository = screeningRepository;
        this.patientRepository = patientRepository;
        this.events = events;
    }

    @PostMapping(
            value = "/analyze",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public Screening analyze(
            @RequestParam("patientId") String patientId,
            @RequestParam("file") MultipartFile file,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        // Only patients can start their own screening.
        if (!"PATIENT".equals(userRole)) {
            throw ApiException.forbidden(
                    "Only patients can start a screening."
            );
        }

        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest(
                    "Please choose a retinal image to upload."
            );
        }

        // Find the patient profile.
        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(
                        () -> ApiException.notFound(
                                "Patient not found."
                        )
                );

        // Make sure this patient belongs to
        // the currently logged-in account.
        if (!userId.equals(patient.getUserId())) {
            throw ApiException.forbidden(
                    "You are not authorized to screen this patient."
            );
        }

        // Send image to the Python AI service.
        AiPredictionResponse aiResponse =
                aiServiceClient.predict(file);

        if (aiResponse == null) {
            throw ApiException.badRequest(
                    "AI service returned an empty response."
            );
        }

        Screening screening = new Screening();

        screening.setPatientId(patientId);

        screening.setPrediction(
                aiResponse.getPrediction()
        );

        screening.setClassId(
                aiResponse.getClassId()
        );

        screening.setConfidence(
                aiResponse.getConfidence()
        );

        screening.setProbabilities(
                aiResponse.getProbabilities()
        );

        // The AI service returns the pictures inline; store them, because its
        // own filesystem does not survive a restart.
        screening.setOriginalImage(decode(aiResponse.getOriginalImage()));
        screening.setHeatmapImage(decode(aiResponse.getHeatmap()));
        screening.setOverlayImage(decode(aiResponse.getOverlay()));

        // Carry the honesty flag: placeholder weights must be visible in the UI.
        screening.setModelTrained(aiResponse.isModelTrained());
        screening.setModelMetrics(aiResponse.getModelMetrics());
        screening.setQuality(aiResponse.getQuality());

        // AI result is only a suggestion until a doctor signs it off.
        screening.setStatus("PENDING_REVIEW");

        screening.setCreatedAt(
                LocalDateTime.now()
        );

        Screening saved =
                screeningRepository.save(screening);

        // Push it to every doctor watching the queue.
        events.screeningCreated(
                saved.getId(),
                patient.getId(),
                patient.getName(),
                saved.getPrediction()
        );

        return saved;
    }

    /**
     * Live viewfinder frame. Runs the model and returns the grade, but writes
     * nothing to the database and raises no doctor event - only an explicit
     * /analyze becomes a screening on the record.
     */
    @PostMapping(
            value = "/live",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public AiPredictionResponse live(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "heatmap", defaultValue = "false")
            boolean heatmap,
            @RequestAttribute("userRole") String userRole) {

        if (!"PATIENT".equals(userRole)) {
            throw ApiException.forbidden(
                    "Only patients can run a live screening."
            );
        }

        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest(
                    "Empty frame."
            );
        }

        return aiServiceClient.predictLive(file, heatmap);
    }

    /**
     * One image from one screening.
     *
     * A browser cannot put an Authorization header on an <img> tag, so this
     * route also accepts the token as a query parameter - the same allowance
     * the event stream already has, and nowhere else.
     */
    @GetMapping("/{id}/image/{kind}")
    public ResponseEntity<byte[]> image(
            @PathVariable String id,
            @PathVariable String kind,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        Screening screening = screeningRepository
                .findById(id)
                .orElseThrow(
                        () -> ApiException.notFound("Screening not found.")
                );

        // Doctors may see any screening; a patient only their own.
        if (!"DOCTOR".equals(userRole)) {

            Patient patient = patientRepository
                    .findById(screening.getPatientId())
                    .orElseThrow(
                            () -> ApiException.notFound("Patient not found.")
                    );

            if (!userId.equals(patient.getUserId())) {
                throw ApiException.forbidden(
                        "You are not authorized to view this image."
                );
            }
        }

        byte[] data = switch (kind) {
            case "original" -> screening.getOriginalImage();
            case "heatmap" -> screening.getHeatmapImage();
            case "overlay" -> screening.getOverlayImage();
            default -> throw ApiException.badRequest(
                    "Unknown image: " + kind
            );
        };

        if (data == null || data.length == 0) {
            throw ApiException.notFound(
                    "This screening was taken before images were stored with "
                            + "the record, so its pictures are no longer available."
            );
        }

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(
                        CacheControl.maxAge(30, TimeUnit.DAYS).cachePrivate()
                )
                .body(data);
    }

    private byte[] decode(String base64) {

        if (base64 == null || base64.isBlank()) {
            return null;
        }

        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException error) {
            return null;
        }
    }

    @GetMapping("/patient/{patientId}")
    public List<Screening> getPatientScreenings(
            @PathVariable String patientId,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(
                        () -> ApiException.notFound(
                                "Patient not found."
                        )
                );

        // Doctors may view any history; patients only their own.
        if (!"DOCTOR".equals(userRole)
                && !userId.equals(patient.getUserId())) {

            throw ApiException.forbidden(
                    "You are not authorized to view this screening history."
            );
        }

        return screeningRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId);
    }
}
