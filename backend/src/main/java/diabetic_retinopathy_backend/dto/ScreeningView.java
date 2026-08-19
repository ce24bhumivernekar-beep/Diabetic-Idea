package diabetic_retinopathy_backend.dto;

import java.time.LocalDateTime;
import java.util.Map;

import diabetic_retinopathy_backend.model.Patient;
import diabetic_retinopathy_backend.model.Screening;

/**
 * A screening plus the patient details the doctor screens need.
 * Every field of Screening is kept, so the React pages that already read
 * prediction / heatmapPath / status keep working unchanged.
 */
public class ScreeningView {

    private String id;

    private String patientId;

    private String eye;

    private String patientName;

    private Integer patientAge;

    private String patientGender;

    private String originalImagePath;

    private String heatmapPath;

    private String overlayPath;

    private String prediction;

    private int classId;

    private double confidence;

    private Map<String, Double> probabilities;

    private boolean modelTrained;

    private Map<String, Object> modelMetrics;

    private Map<String, Object> quality;

    /** Whether a specialist should see this person, and the cut behind it. */
    private Boolean referable;

    /** P(grade >= 2) - the number the referral threshold is applied to. */
    private Double referableProbability;

    private Map<String, Object> referralBasis;

    private String status;

    private LocalDateTime createdAt;

    private String doctorDecision;

    private String doctorRemarks;

    private String reviewedBy;

    private LocalDateTime reviewedAt;

    public static ScreeningView of(
            Screening screening,
            Patient patient) {

        ScreeningView view = new ScreeningView();

        view.id = screening.getId();
        view.patientId = screening.getPatientId();
        view.eye = screening.getEye();
        view.originalImagePath = screening.getOriginalImagePath();
        view.heatmapPath = screening.getHeatmapPath();
        view.overlayPath = screening.getOverlayPath();
        view.prediction = screening.getPrediction();
        view.classId = screening.getClassId();
        view.confidence = screening.getConfidence();
        view.probabilities = screening.getProbabilities();
        view.modelTrained = screening.isModelTrained();
        view.modelMetrics = screening.getModelMetrics();
        view.quality = screening.getQuality();
        view.referable = screening.getReferable();
        view.referableProbability = screening.getReferableProbability();
        view.referralBasis = screening.getReferralBasis();
        view.status = screening.getStatus();
        view.createdAt = screening.getCreatedAt();
        view.doctorDecision = screening.getDoctorDecision();
        view.doctorRemarks = screening.getDoctorRemarks();
        view.reviewedBy = screening.getReviewedBy();
        view.reviewedAt = screening.getReviewedAt();

        if (patient != null) {
            view.patientName = patient.getName();
            view.patientAge = patient.getAge();
            view.patientGender = patient.getGender();
        }

        return view;
    }

    public String getId() {
        return id;
    }

    public String getPatientId() {
        return patientId;
    }

    public String getPatientName() {
        return patientName;
    }

    public Integer getPatientAge() {
        return patientAge;
    }

    public String getPatientGender() {
        return patientGender;
    }

    public String getOriginalImagePath() {
        return originalImagePath;
    }

    public String getHeatmapPath() {
        return heatmapPath;
    }

    public String getOverlayPath() {
        return overlayPath;
    }

    public String getPrediction() {
        return prediction;
    }

    public int getClassId() {
        return classId;
    }

    public double getConfidence() {
        return confidence;
    }

    public Map<String, Double> getProbabilities() {
        return probabilities;
    }

    public Map<String, Object> getModelMetrics() {
        return modelMetrics;
    }

    public String getEye() {
        return eye;
    }


    public Double getReferableProbability() {
        return referableProbability;
    }

    public void setReferableProbability(Double referableProbability) {
        this.referableProbability = referableProbability;
    }

    public Boolean getReferable() {
        return referable;
    }

    public Map<String, Object> getReferralBasis() {
        return referralBasis;
    }

    public Map<String, Object> getQuality() {
        return quality;
    }

    public boolean isModelTrained() {
        return modelTrained;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getDoctorDecision() {
        return doctorDecision;
    }

    public String getDoctorRemarks() {
        return doctorRemarks;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }
}
