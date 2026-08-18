package diabetic_retinopathy_backend.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import diabetic_retinopathy_backend.model.TriageAssessment;

public interface TriageAssessmentRepository
        extends MongoRepository<TriageAssessment, String> {

    List<TriageAssessment> findByPatientIdOrderByCreatedAtDesc(String patientId);

    List<TriageAssessment> findAllByOrderByCreatedAtDesc();
}
