package diabetic_retinopathy_backend.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import diabetic_retinopathy_backend.model.Screening;

public interface ScreeningRepository
        extends MongoRepository<Screening, String> {

    List<Screening> findByPatientIdOrderByCreatedAtDesc(String patientId);

    List<Screening> findAllByOrderByCreatedAtDesc();
}