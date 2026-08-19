import { Link } from "react-router-dom";

/**
 * The AI in detail: what the model is, how the heatmap is produced, what it
 * scores on held-out data, and what those numbers mean in practice.
 */
function AiScreeningInfo() {
  return (
    <div className="container about-page">

      <h1>AI Screening Info</h1>

      <p className="subtitle">
        What the model does, how it explains itself, and how accurate it
        actually is.
      </p>

      <section className="about-section">

        <h2>The model</h2>

        <p>
          Retinal images are graded on the International Clinical Diabetic
          Retinopathy scale, from 0 (no retinopathy) through 1 (mild), 2
          (moderate) and 3 (severe) to 4 (proliferative). The network is an
          EfficientNetB0 convolutional model trained on 25,290 labelled fundus
          photographs, with 2,810 more held back for validation and 7,026 never
          seen during training at all.
        </p>

        <p>
          Every prediction returns the full spread across all five grades, not
          just the winner. A case split 45/40 between moderate and severe is a
          different clinical situation from one at 95% moderate, and hiding
          that behind a single label would throw the information away.
        </p>

      </section>

      <section className="about-section">

        <h2>How it explains itself</h2>

        <p>
          Alongside each grade the service produces a Grad-CAM heatmap: a map
          of which regions of the retina moved the decision, drawn over the
          original image. It is what turns "grade 3" into something a clinician
          can check.
        </p>

        <p>
          The network ends in a global average pooling layer feeding a single
          dense layer. For that shape, the weights Grad-CAM would derive from
          gradients are mathematically identical to the dense layer's own
          weights, so the heatmap needs one forward pass and a matrix multiply
          instead of a full training framework. That is what lets the service
          run in 122 MB of memory and return a result in about 27 milliseconds.
        </p>

      </section>

      <section className="about-section">

        <h2>Measured accuracy</h2>

        <p>
          These numbers come from the 7,026 held-out images the model never saw
          during training.
        </p>

        <dl className="about-parts">
          <dt>Agreement with human graders (quadratic weighted kappa)</dt>
          <dd>
            <strong>0.364</strong> — moderate agreement. Kappa is the standard
            measure here because it penalises being badly wrong on an ordered
            scale far more than being one grade off.
          </dd>

          <dt>Referable disease detected (sensitivity)</dt>
          <dd>
            <strong>64.9%</strong> — of the cases that genuinely needed a
            specialist, roughly two in three were flagged.
          </dd>

          <dt>Correctly cleared (specificity)</dt>
          <dd>
            <strong>77.5%</strong> — of the healthy retinas, about three in
            four were correctly passed over.
          </dd>
        </dl>

        <p className="about-caution">
          What this means in practice: about one in three referable cases is
          missed, so a low grade from this model does not rule out
          retinopathy. It is useful for deciding who to look at first, and not
          accurate enough to decide care on its own. That is exactly why every
          screening goes to a doctor, and why the measured figures appear on
          every result and every printed report rather than being kept out of
          sight.
        </p>

        <p>
          Accuracy improves with a larger and better-balanced training set; the
          model is retrainable and the pipeline that produced these numbers is
          part of the project.
        </p>

      </section>

      <section className="about-section">

        <h2>Live analysis</h2>

        <p>
          While the camera is open, frames are graded continuously - roughly
          two to three per second - and the reading shown is averaged over the
          last few frames, because single-frame predictions jitter. Those
          frames are analysed and discarded; nothing is stored until the
          patient chooses to save one.
        </p>

      </section>

      <section className="about-section">

        <h2>The camera-only measurements</h2>

        <p>
          The health check does not use the retinopathy model at all. It runs
          signal processing on what a bare camera can see, and each measurement
          reports its own quality so an unusable recording is excluded from the
          score rather than quietly weakening it.
        </p>

        <dl className="about-parts">
          <dt>Pulse and heart-rate variability</dt>
          <dd>
            From the red channel of a fingertip held over the lens. Validated
            against synthetic signals with known rates to a mean error of 0.05
            beats per minute between 48 and 132 bpm.
          </dd>

          <dt>Pupil light reflex</dt>
          <dd>
            How far and how quickly the pupil constricts when the light fires,
            measured in millimetres. The iris is used as the ruler - it is
            about 11.7 mm across in adults - so no calibration card or fixed
            distance is needed. Pupil diameter is recovered to within 0.33 mm.
          </dd>

          <dt>Conjunctival pallor</dt>
          <dd>
            The colour of the inner lower eyelid, white-balanced against the
            white of the eye in the same photograph, which cancels out the
            phone's own colour processing and the room lighting. Reported as an
            index rather than a haemoglobin figure, because turning it into
            g/dL would need calibration against blood tests this project does
            not have.
          </dd>
        </dl>

      </section>

      <div className="page-actions">
        <Link className="action-button" to="/patient/screening">
          Start a screening
        </Link>

        <Link className="nav-button" to="/about">
          About the project
        </Link>
      </div>

    </div>
  );
}

export default AiScreeningInfo;
