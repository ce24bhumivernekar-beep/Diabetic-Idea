package diabetic_retinopathy_backend.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A camera-only screening: what the phone could measure without a fundus
 * lens, plus the answers the patient gave, plus the priority that came out.
 *
 * This decides who needs a retinal exam first. It is not a diagnosis of
 * retinopathy - only a retinal image can give that.
 */
@Document(collection = "triage_assessments")
public class TriageAssessment {

    @Id
    private String id;

    private String patientId;

    /** Raw measurement blocks, exactly as the AI service returned them. */
    private Map<String, Object> ppg;

    private Map<String, Object> plr;

    private Map<String, Object> pallor;

    private Questionnaire questionnaire;

    private int score;

    private String priority;

    private String recommendedWithin;

    private List<String> reasons;

    private List<String> measurementsUsed;

    private List<String> measurementsSkipped;

    private LocalDateTime createdAt;

    public static class Questionnaire {

        private Integer age;

        private Integer yearsWithDiabetes;

        private Double hba1c;

        private Integer systolicBp;

        private Boolean smoker;

        private Boolean visionSymptoms;

        public Integer getAge() {
            return age;
        }

        public void setAge(Integer age) {
            this.age = age;
        }

        public Integer getYearsWithDiabetes() {
            return yearsWithDiabetes;
        }

        public void setYearsWithDiabetes(Integer yearsWithDiabetes) {
            this.yearsWithDiabetes = yearsWithDiabetes;
        }

        public Double getHba1c() {
            return hba1c;
        }

        public void setHba1c(Double hba1c) {
            this.hba1c = hba1c;
        }

        public Integer getSystolicBp() {
            return systolicBp;
        }

        public void setSystolicBp(Integer systolicBp) {
            this.systolicBp = systolicBp;
        }

        public Boolean getSmoker() {
            return smoker;
        }

        public void setSmoker(Boolean smoker) {
            this.smoker = smoker;
        }

        public Boolean getVisionSymptoms() {
            return visionSymptoms;
        }

        public void setVisionSymptoms(Boolean visionSymptoms) {
            this.visionSymptoms = visionSymptoms;
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public Map<String, Object> getPpg() {
        return ppg;
    }

    public void setPpg(Map<String, Object> ppg) {
        this.ppg = ppg;
    }

    public Map<String, Object> getPlr() {
        return plr;
    }

    public void setPlr(Map<String, Object> plr) {
        this.plr = plr;
    }

    public Map<String, Object> getPallor() {
        return pallor;
    }

    public void setPallor(Map<String, Object> pallor) {
        this.pallor = pallor;
    }

    public Questionnaire getQuestionnaire() {
        return questionnaire;
    }

    public void setQuestionnaire(Questionnaire questionnaire) {
        this.questionnaire = questionnaire;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getRecommendedWithin() {
        return recommendedWithin;
    }

    public void setRecommendedWithin(String recommendedWithin) {
        this.recommendedWithin = recommendedWithin;
    }

    public List<String> getReasons() {
        return reasons;
    }

    public void setReasons(List<String> reasons) {
        this.reasons = reasons;
    }

    public List<String> getMeasurementsUsed() {
        return measurementsUsed;
    }

    public void setMeasurementsUsed(List<String> measurementsUsed) {
        this.measurementsUsed = measurementsUsed;
    }

    public List<String> getMeasurementsSkipped() {
        return measurementsSkipped;
    }

    public void setMeasurementsSkipped(List<String> measurementsSkipped) {
        this.measurementsSkipped = measurementsSkipped;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
