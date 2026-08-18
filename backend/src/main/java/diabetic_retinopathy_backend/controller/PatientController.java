package diabetic_retinopathy_backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.exception.ApiException;
import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.User;
import diabetic_retinopathy_backend.repository.PatientRepository;
import diabetic_retinopathy_backend.repository.UserRepository;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;

    public PatientController(
            PatientRepository patientRepository,
            UserRepository userRepository) {

        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
    }

    /**
     * Creates the clinical profile for the logged-in account.
     * The link is taken from the token, never from the request body.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Patient createPatient(
            @RequestBody Patient patient,
            @RequestAttribute("userId") String userId) {

        User user = userRepository
                .findById(userId)
                .orElseThrow(
                        () -> ApiException.notFound(
                                "Authentication user not found."
                        )
                );

        patientRepository
                .findByUserId(userId)
                .ifPresent(existing -> {
                    throw ApiException.conflict(
                            "A patient profile already exists for this account."
                    );
                });

        patient.setUserId(user.getId());

        // Keep the profile email in step with the login email.
        patient.setEmail(user.getEmail());

        return patientRepository.save(patient);
    }

    @GetMapping
    public List<Patient> getAllPatients(
            @RequestAttribute("userRole") String userRole) {

        if (!"DOCTOR".equals(userRole)) {
            throw ApiException.forbidden(
                    "Doctor access required."
            );
        }

        return patientRepository.findAll();
    }

    @GetMapping("/{id}")
    public Patient getPatient(
            @PathVariable String id,
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        Patient patient = patientRepository
                .findById(id)
                .orElseThrow(
                        () -> ApiException.notFound(
                                "Patient not found."
                        )
                );

        assertVisible(patient, userId, userRole);

        return patient;
    }

    @GetMapping("/user/{userId}")
    public Patient getPatientByUserId(
            @PathVariable String userId,
            @RequestAttribute("userId") String authenticatedUserId,
            @RequestAttribute("userRole") String userRole) {

        Patient patient = patientRepository
                .findByUserId(userId)
                .orElseThrow(
                        () -> ApiException.notFound(
                                "Patient profile not found."
                        )
                );

        assertVisible(patient, authenticatedUserId, userRole);

        return patient;
    }

    private void assertVisible(
            Patient patient,
            String userId,
            String userRole) {

        if ("DOCTOR".equals(userRole)) {
            return;
        }

        if (!userId.equals(patient.getUserId())) {
            throw ApiException.forbidden(
                    "You are not authorized to view this patient profile."
            );
        }
    }
}
