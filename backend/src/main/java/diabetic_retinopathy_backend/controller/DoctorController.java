package diabetic_retinopathy_backend.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.dto.ScreeningView;
import diabetic_retinopathy_backend.exception.ApiException;
import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.Screening;
import diabetic_retinopathy_backend.repository.PatientRepository;
import diabetic_retinopathy_backend.repository.ScreeningRepository;
import diabetic_retinopathy_backend.service.ScreeningEventService;

/**
 * Doctor workflow. The DOCTOR role is already enforced for every
 * /api/doctor path by JwtAuthenticationFilter; the checks here are a
 * second line of defence.
 */
@RestController
@RequestMapping("/api/doctor")
public class DoctorController {

    private final ScreeningRepository screeningRepository;
    private final PatientRepository patientRepository;
    private final ScreeningEventService events;

    public DoctorController(
            ScreeningRepository screeningRepository,
            PatientRepository patientRepository,
            ScreeningEventService events) {

        this.screeningRepository = screeningRepository;
        this.patientRepository = patientRepository;
        this.events = events;
    }

    // ---------------------------------------------------------
    // Get all screenings for doctor dashboard
    // ---------------------------------------------------------

    @GetMapping("/screenings")
    public List<ScreeningView> getAllScreenings(
            @RequestAttribute("userRole") String userRole) {

        requireDoctor(userRole);

        return screeningRepository
                .findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::withPatient)
                .toList();
    }

    // ---------------------------------------------------------
    // Get one screening
    // ---------------------------------------------------------

    @GetMapping("/screening/{id}")
    public ScreeningView getScreening(
            @PathVariable String id,
            @RequestAttribute("userRole") String userRole) {

        requireDoctor(userRole);

        return withPatient(findScreening(id));
    }

    // ---------------------------------------------------------
    // Review a screening
    // ---------------------------------------------------------

    @PutMapping("/screening/{id}/review")
    public ScreeningView reviewScreening(
            @PathVariable String id,
            @RequestParam String decision,
            @RequestParam String remarks,
            @RequestParam String doctorName,
            @RequestAttribute("userRole") String userRole) {

        requireDoctor(userRole);

        Screening screening = findScreening(id);

        screening.setDoctorDecision(decision);
        screening.setDoctorRemarks(remarks);
        screening.setReviewedBy(doctorName);
        screening.setReviewedAt(LocalDateTime.now());
        screening.setStatus("REVIEWED");

        Screening saved =
                screeningRepository.save(screening);

        // Tell the patient who owns this scan.
        Patient owner = patientRepository
                .findById(saved.getPatientId())
                .orElse(null);

        events.screeningReviewed(
                saved.getId(),
                owner == null ? null : owner.getUserId(),
                saved.getDoctorDecision(),
                saved.getReviewedBy()
        );

        return withPatient(saved);
    }

    private Screening findScreening(String id) {

        return screeningRepository
                .findById(id)
                .orElseThrow(
                        () -> ApiException.notFound(
                                "Screening not found."
                        )
                );
    }

    private void requireDoctor(String userRole) {

        if (!"DOCTOR".equals(userRole)) {
            throw ApiException.forbidden(
                    "Doctor access required."
            );
        }
    }

    /**
     * The dashboard needs to show whose scan it is, so patient
     * name / age / gender travel together with the screening.
     */
    private ScreeningView withPatient(Screening screening) {

        Patient patient = patientRepository
                .findById(screening.getPatientId())
                .orElse(null);

        return ScreeningView.of(screening, patient);
    }
}
