package diabetic_retinopathy_backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.User;
import diabetic_retinopathy_backend.repository.PatientRepository;
import diabetic_retinopathy_backend.repository.UserRepository;

@CrossOrigin(origins = "http://localhost:5173")
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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Patient createPatient(
            @RequestBody Patient patient) {

        // Find the authentication user using email
        User user = userRepository
                .findByEmail(patient.getEmail())
                .orElseThrow(
                        () -> new RuntimeException(
                                "Authentication user not found."
                        )
                );

        // Automatically link patient profile
        patient.setUserId(user.getId());

        return patientRepository.save(patient);
    }

    @GetMapping
    public List<Patient> getAllPatients() {

        return patientRepository.findAll();
    }

    @GetMapping("/{id}")
    public Patient getPatient(
            @PathVariable String id) {

        return patientRepository
                .findById(id)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Patient not found"
                        )
                );
    }

    @GetMapping("/user/{userId}")
    public Patient getPatientByUserId(
            @PathVariable String userId) {

        return patientRepository
                .findByUserId(userId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Patient profile not found"
                        )
                );
    }
}