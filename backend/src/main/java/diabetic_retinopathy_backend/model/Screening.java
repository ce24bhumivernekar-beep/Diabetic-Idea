package diabetic_retinopathy_backend.model;

import java.time.LocalDateTime;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnore;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "screenings")
public class Screening {

    @Id
    private String id;

    private String patientId;

    /**
     * The pictures themselves, stored with the record.
     *
     * They used to live on the AI service's local disk, which is recreated on
     * every restart - so any screening older than the running container lost
     * its images while this document went on pointing at them. Marked
     * JsonIgnore so a list of screenings does not carry megabytes of base64;
     * they are fetched one at a time from /api/screenings/{id}/image/{kind}.
     */
    @JsonIgnore
    private byte[] originalImage;

    @JsonIgnore
    private byte[] heatmapImage;

    @JsonIgnore
    private byte[] overlayImage;

    private String originalImagePath;

    private String heatmapPath;

    private String overlayPath;

    private String prediction;

    private int classId;

    private double confidence;

    private Map<String, Double> probabilities;

    /** False when the AI ran on placeholder weights. */
    private boolean modelTrained;

    private Map<String, Object> modelMetrics;

    /**
     * Whether the image was gradable, and why not when it was not. A grade
     * from an ungradable photograph is the most dangerous output this system
     * can produce, so the verdict travels with the record and onto the report.
     */
    private Map<String, Object> quality;

    private String status;

    private LocalDateTime createdAt;

    // Doctor review fields
    private String doctorDecision;

    private String doctorRemarks;

    private String reviewedBy;

    private LocalDateTime reviewedAt;

    public Screening() {
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

    public byte[] getOriginalImage() {
        return originalImage;
    }

    public void setOriginalImage(byte[] originalImage) {
        this.originalImage = originalImage;
    }

    public byte[] getHeatmapImage() {
        return heatmapImage;
    }

    public void setHeatmapImage(byte[] heatmapImage) {
        this.heatmapImage = heatmapImage;
    }

    public byte[] getOverlayImage() {
        return overlayImage;
    }

    public void setOverlayImage(byte[] overlayImage) {
        this.overlayImage = overlayImage;
    }

    public String getOriginalImagePath() {
        return originalImagePath;
    }

    public void setOriginalImagePath(String originalImagePath) {
        this.originalImagePath = originalImagePath;
    }

    public String getHeatmapPath() {
        return heatmapPath;
    }

    public void setHeatmapPath(String heatmapPath) {
        this.heatmapPath = heatmapPath;
    }

    public String getOverlayPath() {
        return overlayPath;
    }

    public void setOverlayPath(String overlayPath) {
        this.overlayPath = overlayPath;
    }

    public String getPrediction() {
        return prediction;
    }

    public void setPrediction(String prediction) {
        this.prediction = prediction;
    }

    public int getClassId() {
        return classId;
    }

    public void setClassId(int classId) {
        this.classId = classId;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public Map<String, Double> getProbabilities() {
        return probabilities;
    }

    public void setProbabilities(Map<String, Double> probabilities) {
        this.probabilities = probabilities;
    }

    public Map<String, Object> getModelMetrics() {
        return modelMetrics;
    }

    public void setModelMetrics(Map<String, Object> modelMetrics) {
        this.modelMetrics = modelMetrics;
    }

    public Map<String, Object> getQuality() {
        return quality;
    }

    public void setQuality(Map<String, Object> quality) {
        this.quality = quality;
    }

    public boolean isModelTrained() {
        return modelTrained;
    }

    public void setModelTrained(boolean modelTrained) {
        this.modelTrained = modelTrained;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getDoctorDecision() {
        return doctorDecision;
    }

    public void setDoctorDecision(String doctorDecision) {
        this.doctorDecision = doctorDecision;
    }

    public String getDoctorRemarks() {
        return doctorRemarks;
    }

    public void setDoctorRemarks(String doctorRemarks) {
        this.doctorRemarks = doctorRemarks;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }
}