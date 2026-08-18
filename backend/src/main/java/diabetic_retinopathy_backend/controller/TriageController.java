package diabetic_retinopathy_backend.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import diabetic_retinopathy_backend.client.AiServiceClient;
import diabetic_retinopathy_backend.exception.ApiException;
import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.TriageAssessment;
import diabetic_retinopathy_backend.repository.PatientRepository;
import diabetic_retinopathy_backend.repository.TriageAssessmentRepository;
import diabetic_retinopathy_backend.service.ScreeningEventService;
import diabetic_retinopathy_backend.service.TriageScoringService;

/**
 * Camera-only screening: measurements a phone can take without a fundus lens,
 * scored into a priority for a retinal exam.
 *
 * The three measurement endpoints are stateless - they run a signal through
 * the AI service and hand the numbers straight back, so the patient can retake
 * a bad recording without anything being stored. Only POST /api/triage records
 * an assessment and tells the doctors about it.
 */
@RestController
@RequestMapping("/api/triage")
public class TriageController {

    private final AiServiceClient aiServiceClient;
    private final TriageAssessmentRepository triageRepository;
    private final PatientRepository patientRepository;
    private final TriageScoringService scoringService;
    private final ScreeningEventService events;

    public TriageController(
            AiServiceClient aiServiceClient,
            TriageAssessmentRepository triageRepository,
            PatientRepository patientRepository,
            TriageScoringService scoringService,
            ScreeningEventService events) {

        this.aiServiceClient = aiServiceClient;
        this.triageRepository = triageRepository;
        this.patientRepository = patientRepository;
        this.scoringService = scoringService;
        this.events = events;
    }

    // ---------------------------------------------------------
    // Measurements
    // ---------------------------------------------------------

    @PostMapping(value = "/ppg", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> ppg(
            @RequestBody Map<String, Object> payload,
            @RequestAttribute("userRole") String userRole) {

        requirePatient(userRole);

        return aiServiceClient.analysePpg(payload);
    }

    @PostMapping(value = "/plr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> plr(
            @RequestParam("frames") List<MultipartFile> frames,
            @RequestParam("timestampsMs") String timestampsMs,
            @RequestParam(value = "lightOnIndex", defaultValue = "0")
            int lightOnIndex,
            @RequestAttribute("userRole") String userRole) {

        requirePatient(userRole);

        if (frames == null || frames.size() < 8) {
            throw ApiException.badRequest(
                    "Send at least 8 frames of the eye."
            );
        }

        return aiServiceClient.analysePlr(
                frames,
                timestampsMs,
                lightOnIndex
        );
    }

    @PostMapping(value = "/pallor", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> pallor(
            @RequestParam("file") MultipartFile file,
            @RequestParam("conjunctivaBox") String conjunctivaBox,
            @RequestParam("scleraBox") String scleraBox,
            @RequestAttribute("userRole") String userRole) {

        requirePatient(userRole);

        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No photo received.");
        }

        return aiServiceClient.analysePallor(
                file,
                conjunctivaBox,
                scleraBox
        );
    }

    // ---------------------------------------------------------
    // Recording an assessment
    // ---------------------------------------------------------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TriageAssessment save(
            @RequestBody TriageAssessment assessment,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        requirePatient(userRole);

        Patient patient = patientRepository
                .findById(assessment.getPatientId())
                .orElseThrow(
                        () -> ApiException.notFound("Patient not found.")
                );

        if (!userId.equals(patient.getUserId())) {
            throw ApiException.forbidden(
                    "You are not authorized to record this assessment."
            );
        }

        scoringService.score(assessment);

        assessment.setId(null);
        assessment.setCreatedAt(LocalDateTime.now());

        TriageAssessment saved = triageRepository.save(assessment);

        events.triageRecorded(
                saved.getId(),
                patient.getId(),
                patient.getName(),
                saved.getPriority(),
                saved.getScore()
        );

        return saved;
    }

    // ---------------------------------------------------------
    // Reading assessments
    // ---------------------------------------------------------

    @GetMapping("/patient/{patientId}")
    public List<TriageAssessment> forPatient(
            @PathVariable String patientId,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        Patient patient = patientRepository
                .findById(patientId)
                .orElseThrow(
                        () -> ApiException.notFound("Patient not found.")
                );

        if (!"DOCTOR".equals(userRole)
                && !userId.equals(patient.getUserId())) {

            throw ApiException.forbidden(
                    "You are not authorized to view these assessments."
            );
        }

        return triageRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    private void requirePatient(String userRole) {

        if (!"PATIENT".equals(userRole)) {
            throw ApiException.forbidden(
                    "Only patients can run a camera screening."
            );
        }
    }
}
