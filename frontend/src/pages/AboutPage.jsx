import { Link } from "react-router-dom";

/**
 * The destination the landing nav needed. The landing page itself is a fixed
 * viewport composition (overflow: hidden) with nothing below the fold, so the
 * explanatory content lives here where it can scroll.
 */
function AboutPage() {
  return (
    <div className="container about-page">

      <h1>About RetiNova</h1>

      <p className="subtitle">
        Diabetic retinopathy screening, and an honest account of what it can
        and cannot do.
      </p>

      <section className="about-section" id="ai-analysis">

        <h2>How the AI analysis works</h2>

        <p>
          A retinal photograph is graded on the International Clinical Diabetic
          Retinopathy scale, from 0 (no retinopathy) to 4 (proliferative). The
          model is an EfficientNetB0 network trained on 25,290 labelled fundus
          images and served through ONNX Runtime, which returns a grade in
          about 27 milliseconds.
        </p>

        <p>
          Every result carries a Grad-CAM heatmap showing which regions of the
          retina drove the grade. That matters more than the grade itself: a
          model that is right for the wrong reasons is not usable, and the
          heatmap is what lets a clinician check.
        </p>

        <h3>Measured accuracy</h3>

        <p>
          On 7,026 held-out images the model reaches a quadratic weighted kappa
          of <strong>0.364</strong>, catching <strong>64.9%</strong> of
          referable disease at <strong>77.5%</strong> specificity.
        </p>

        <p className="about-caution">
          Those numbers are modest, and we publish them rather than hide them.
          The model is useful for prioritising who gets seen first. It is not
          accurate enough to decide care on its own, and roughly one in three
          referable cases is missed. Every result is reviewed by a doctor.
        </p>

      </section>

      <section className="about-section" id="camera-check">

        <h2>The camera health check</h2>

        <p>
          A phone camera cannot photograph the retina - that needs a lens in
          front of it. So the camera-only check measures what a camera
          genuinely can see: pulse and heart-rate variability from a fingertip,
          the pupil's response to light, and conjunctival pallor from the lower
          eyelid.
        </p>

        <p>
          Those signals do not diagnose retinopathy. They estimate how urgently
          someone should get a proper retinal exam, which is the real
          bottleneck when there are far more people with diabetes than there
          are retinal cameras.
        </p>

      </section>

      <section className="about-section" id="privacy">

        <h2>Your data</h2>

        <p>
          Screening images and results are stored against your account and are
          visible to you and to reviewing clinicians. The live camera view is
          analysed frame by frame and nothing from it is stored unless you
          press save.
        </p>

      </section>

      <div className="page-actions">
        <Link className="action-button" to="/patient/screening">
          Start a screening
        </Link>

        <Link className="nav-button" to="/">
          Back to home
        </Link>
      </div>

    </div>
  );
}

export default AboutPage;
