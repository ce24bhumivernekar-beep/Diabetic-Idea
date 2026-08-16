package diabetic_retinopathy_backend.repository;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import diabetic_retinopathy_backend.model.Patient;

public interface PatientRepository
        extends MongoRepository<Patient, String> {

    Optional<Patient> findByEmail(String email);
}