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
import diabetic_retinopathy_backend.repository.PatientRepository;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientRepository patientRepository;

    public PatientController(
            PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Patient createPatient(
            @RequestBody Patient patient) {

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
}