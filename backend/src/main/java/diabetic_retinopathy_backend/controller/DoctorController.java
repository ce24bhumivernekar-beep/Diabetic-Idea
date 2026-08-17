package diabetic_retinopathy_backend.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.model.Screening;
import diabetic_retinopathy_backend.repository.ScreeningRepository;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/doctor")
public class DoctorController {

    private final ScreeningRepository screeningRepository;

    public DoctorController(
            ScreeningRepository screeningRepository) {

        this.screeningRepository = screeningRepository;
    }

    // ---------------------------------------------------------
    // Get all screenings for doctor dashboard
    // ---------------------------------------------------------

    @GetMapping("/screenings")
    public List<Screening> getAllScreenings(
            @RequestAttribute("userRole") String userRole) {

        if (!"DOCTOR".equals(userRole)) {
            throw new RuntimeException(
                    "Doctor access required."
            );
        }

        return screeningRepository.findAll();
    }

    // ---------------------------------------------------------
    // Get one screening
    // ---------------------------------------------------------

    @GetMapping("/screening/{id}")
    public ResponseEntity<Screening> getScreening(
            @PathVariable String id,
            @RequestAttribute("userRole") String userRole) {

        if (!"DOCTOR".equals(userRole)) {
            return ResponseEntity.status(403).build();
        }

        Optional<Screening> screening =
                screeningRepository.findById(id);

        return screening
                .map(ResponseEntity::ok)
                .orElseGet(
                        () -> ResponseEntity.notFound().build()
                );
    }

    // ---------------------------------------------------------
    // Review a screening
    // ---------------------------------------------------------

    @PutMapping("/screening/{id}/review")
    public ResponseEntity<Screening> reviewScreening(
            @PathVariable String id,
            @RequestParam String decision,
            @RequestParam String remarks,
            @RequestParam String doctorName,
            @RequestAttribute("userRole") String userRole,
            @RequestAttribute("userId") String userId) {

        if (!"DOCTOR".equals(userRole)) {
            return ResponseEntity.status(403).build();
        }

        Optional<Screening> optionalScreening =
                screeningRepository.findById(id);

        if (optionalScreening.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Screening screening =
                optionalScreening.get();

        screening.setDoctorDecision(decision);
        screening.setDoctorRemarks(remarks);
        screening.setReviewedBy(doctorName);
        screening.setReviewedAt(LocalDateTime.now());
        screening.setStatus("REVIEWED");

        Screening savedScreening =
                screeningRepository.save(screening);

        return ResponseEntity.ok(savedScreening);
    }
}