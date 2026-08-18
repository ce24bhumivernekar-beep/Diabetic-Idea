package diabetic_retinopathy_backend.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import diabetic_retinopathy_backend.model.TriageAssessment;

/**
 * Turns camera-only measurements and answers into a queue position for a
 * retinal exam.
 *
 * What this is: a transparent, additive rule set. Every point it awards comes
 * back with the sentence that explains it, so a doctor can disagree with any
 * single line rather than with a black box.
 *
 * What this is NOT: a validated risk model. The weights follow the direction
 * and rough magnitude of established diabetic retinopathy risk factors
 * (duration of diabetes, glycaemic control, blood pressure) and of autonomic
 * dysfunction markers, but they have not been fitted to outcome data from
 * this population. Treat the output as an ordering of who to see first, not
 * as a probability of disease.
 */
@Service
public class TriageScoringService {

    // Bands, by total score.
    private static final int URGENT_AT = 60;
    private static final int HIGH_AT = 40;
    private static final int MODERATE_AT = 20;

    public void score(TriageAssessment assessment) {

        List<String> reasons = new ArrayList<>();
        List<String> used = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        int total = 0;

        total += scoreQuestionnaire(assessment, reasons);
        total += scoreHrv(assessment, reasons, used, skipped);
        total += scorePupil(assessment, reasons, used, skipped);
        total += scorePallor(assessment, reasons, used, skipped);

        total = Math.min(total, 100);

        assessment.setScore(total);
        assessment.setReasons(reasons);
        assessment.setMeasurementsUsed(used);
        assessment.setMeasurementsSkipped(skipped);

        if (total >= URGENT_AT) {
            assessment.setPriority("URGENT");
            assessment.setRecommendedWithin("1 week");
        } else if (total >= HIGH_AT) {
            assessment.setPriority("HIGH");
            assessment.setRecommendedWithin("4 weeks");
        } else if (total >= MODERATE_AT) {
            assessment.setPriority("MODERATE");
            assessment.setRecommendedWithin("6 months");
        } else {
            assessment.setPriority("ROUTINE");
            assessment.setRecommendedWithin("12 months");
        }
    }

    // ---------------------------------------------------------
    // Answers
    // ---------------------------------------------------------

    private int scoreQuestionnaire(
            TriageAssessment assessment,
            List<String> reasons) {

        TriageAssessment.Questionnaire form =
                assessment.getQuestionnaire();

        if (form == null) {
            return 0;
        }

        int points = 0;

        Integer years = form.getYearsWithDiabetes();

        if (years != null) {

            if (years >= 10) {
                points += 25;
                reasons.add(
                        "Diabetes for " + years
                                + " years - the strongest predictor of retinopathy (+25)"
                );
            } else if (years >= 5) {
                points += 15;
                reasons.add(
                        "Diabetes for " + years + " years (+15)"
                );
            } else {
                points += 5;
                reasons.add(
                        "Diabetes for " + years + " years (+5)"
                );
            }
        }

        Double hba1c = form.getHba1c();

        if (hba1c != null && hba1c > 0) {

            if (hba1c >= 9.0) {
                points += 25;
                reasons.add(
                        "HbA1c " + hba1c + "% - poor glycaemic control (+25)"
                );
            } else if (hba1c >= 7.0) {
                points += 12;
                reasons.add(
                        "HbA1c " + hba1c + "% - above target (+12)"
                );
            }
        }

        Integer systolic = form.getSystolicBp();

        if (systolic != null && systolic >= 140) {
            points += 10;
            reasons.add(
                    "Systolic blood pressure " + systolic
                            + " mmHg - hypertension accelerates retinopathy (+10)"
            );
        }

        Integer age = form.getAge();

        if (age != null && age >= 60) {
            points += 5;
            reasons.add("Age " + age + " (+5)");
        }

        if (Boolean.TRUE.equals(form.getSmoker())) {
            points += 5;
            reasons.add("Smoker (+5)");
        }

        if (Boolean.TRUE.equals(form.getVisionSymptoms())) {
            points += 20;
            reasons.add(
                    "Reports blurred or changing vision - needs an eye exam "
                            + "regardless of the rest of this score (+20)"
            );
        }

        return points;
    }

    // ---------------------------------------------------------
    // Heart-rate variability
    // ---------------------------------------------------------

    private int scoreHrv(
            TriageAssessment assessment,
            List<String> reasons,
            List<String> used,
            List<String> skipped) {

        Map<String, Object> ppg = assessment.getPpg();

        if (!usable(ppg, "hrvReliable")) {
            skipped.add("Heart-rate variability - recording was not clean enough");
            return 0;
        }

        used.add("Heart-rate variability");

        Double rmssd = number(ppg.get("rmssdMs"));

        if (rmssd == null) {
            return 0;
        }

        // Low RMSSD indicates reduced parasympathetic activity, the pattern
        // seen in cardiac autonomic neuropathy.
        if (rmssd < 20) {
            reasons.add(
                    "RMSSD " + rmssd
                            + " ms - markedly reduced heart-rate variability, "
                            + "a pattern seen in autonomic neuropathy (+15)"
            );
            return 15;
        }

        if (rmssd < 30) {
            reasons.add(
                    "RMSSD " + rmssd + " ms - low heart-rate variability (+8)"
            );
            return 8;
        }

        return 0;
    }

    // ---------------------------------------------------------
    // Pupil response
    // ---------------------------------------------------------

    private int scorePupil(
            TriageAssessment assessment,
            List<String> reasons,
            List<String> used,
            List<String> skipped) {

        Map<String, Object> plr = assessment.getPlr();

        if (!usable(plr, "reliable")) {
            skipped.add("Pupil response - the pupil could not be tracked");
            return 0;
        }

        used.add("Pupil light reflex");

        Double constriction = number(plr.get("constrictionPercent"));

        if (constriction == null) {
            return 0;
        }

        // A healthy pupil constricts roughly 30-50% to a bright light.
        if (constriction < 15) {
            reasons.add(
                    "Pupil constricted only " + constriction
                            + "% - a blunted light reflex suggests autonomic "
                            + "involvement (+15)"
            );
            return 15;
        }

        if (constriction < 25) {
            reasons.add(
                    "Pupil constricted " + constriction
                            + "% - below the usual range (+8)"
            );
            return 8;
        }

        return 0;
    }

    // ---------------------------------------------------------
    // Conjunctival pallor
    // ---------------------------------------------------------

    private int scorePallor(
            TriageAssessment assessment,
            List<String> reasons,
            List<String> used,
            List<String> skipped) {

        Map<String, Object> pallor = assessment.getPallor();

        if (!usable(pallor, "reliable")) {
            skipped.add("Conjunctival pallor - photo could not be read");
            return 0;
        }

        used.add("Conjunctival pallor");

        Double index = number(pallor.get("pallorIndex"));

        if (index == null) {
            return 0;
        }

        // Anaemia is associated with faster progression of retinopathy. The
        // index is uncalibrated, so it contributes modestly by design.
        if (index >= 60) {
            reasons.add(
                    "Conjunctival pallor index " + index
                            + " - possible anaemia, worth a blood count (+8)"
            );
            return 8;
        }

        return 0;
    }

    // ---------------------------------------------------------

    private boolean usable(
            Map<String, Object> block,
            String reliableKey) {

        if (block == null) {
            return false;
        }

        if (!Boolean.TRUE.equals(block.get("ok"))) {
            return false;
        }

        return Boolean.TRUE.equals(block.get(reliableKey));
    }

    private Double number(Object value) {

        if (value instanceof Number numeric) {
            return numeric.doubleValue();
        }

        return null;
    }
}
