package diabetic_retinopathy_backend.dto;

import java.util.Map;

public class AiPredictionResponse {

    private String prediction;

    private int classId;

    private double confidence;

    private Map<String, Double> probabilities;

    private boolean modelTrained;

    private Map<String, Object> modelMetrics;

    private String originalImage;

    private String heatmap;

    private String overlay;

    public AiPredictionResponse() {
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

    public boolean isModelTrained() {
        return modelTrained;
    }

    public void setModelTrained(boolean modelTrained) {
        this.modelTrained = modelTrained;
    }

    public Map<String, Object> getModelMetrics() {
        return modelMetrics;
    }

    public void setModelMetrics(Map<String, Object> modelMetrics) {
        this.modelMetrics = modelMetrics;
    }

    public String getOriginalImage() {
        return originalImage;
    }

    public void setOriginalImage(String originalImage) {
        this.originalImage = originalImage;
    }

    public String getHeatmap() {
        return heatmap;
    }

    public void setHeatmap(String heatmap) {
        this.heatmap = heatmap;
    }

    public String getOverlay() {
        return overlay;
    }

    public void setOverlay(String overlay) {
        this.overlay = overlay;
    }
}