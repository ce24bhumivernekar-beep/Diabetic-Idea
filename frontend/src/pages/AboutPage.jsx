import { Link } from "react-router-dom";

/**
 * What the project is and how the parts fit together. The measured accuracy
 * and the limits of the model live on the AI screening info page; this one
 * explains the system.
 */
function AboutPage() {
  return (
    <div className="container about-page">

      <h1>About RetiNova</h1>

      <p className="subtitle">
        A complete diabetic retinopathy screening platform: how it is built,
        what each part does, and how a screening travels through it.
      </p>

      <section className="about-section">

        <h2>The problem it addresses</h2>

        <p>
          Diabetic retinopathy is a leading cause of preventable blindness, and
          it is silent until it is advanced. Screening catches it early, but
          screening needs a retinal camera and someone trained to read the
          image. There are far more people living with diabetes than there are
          retinal cameras, so the bottleneck is not diagnosis - it is deciding
          who gets looked at first, and getting a trained eye onto that image
          quickly once they do.
        </p>

        <p>
          RetiNova addresses both halves: it grades a retinal image
          automatically with a visible explanation, and it puts that result in
          front of a doctor the moment it is taken.
        </p>

      </section>

      <section className="about-section">

        <h2>How the system is built</h2>

        <p>
          Four services, each doing one job, so any of them can be replaced
          without touching the rest.
        </p>

        <dl className="about-parts">

          <dt>Web app (React)</dt>
          <dd>
            What patients and doctors use. It captures images from a phone or
            laptop camera, shows results, and holds the doctor's review
            workflow. It talks only to the API - never to the database, and
            only to the AI service for the images it displays.
          </dd>

          <dt>API (Spring Boot, Java)</dt>
          <dd>
            The gatekeeper. It issues and checks the sign-in tokens, decides
            who is allowed to see which record, forwards images to the AI
            service, stores results, and pushes live updates. Every rule about
            who can do what lives here rather than in the browser, where a user
            could change it.
          </dd>

          <dt>AI service (Python, FastAPI)</dt>
          <dd>
            Stateless image analysis. An image goes in; a grade, a confidence
            spread across all five grades, and three pictures come out. It
            knows nothing about accounts or history, which is what lets it be
            scaled or swapped independently.
          </dd>

          <dt>Database (MongoDB)</dt>
          <dd>
            Accounts, patient profiles, screenings and their reviews, and the
            camera health checks. Only the API touches it.
          </dd>

        </dl>

      </section>

      <section className="about-section">

        <h2>What happens during a screening</h2>

        <ol className="about-steps">
          <li>
            <strong>Capture.</strong> The patient opens the camera in the
            browser. While the camera runs, frames are analysed continuously so
            they can see a live reading and judge the framing before committing
            to anything. Nothing from that live view is stored.
          </li>

          <li>
            <strong>Save.</strong> Pressing save sends one frame to the API,
            which forwards it to the AI service.
          </li>

          <li>
            <strong>Analyse.</strong> The model grades the image and produces a
            heatmap showing which regions drove that grade, plus an overlay of
            the two.
          </li>

          <li>
            <strong>Store.</strong> The API saves the grade, the full
            probability spread, the three images and the model's own measured
            accuracy, marked as awaiting review.
          </li>

          <li>
            <strong>Notify.</strong> The screening appears on every connected
            doctor's queue immediately, over a live connection - no refresh, no
            polling delay.
          </li>

          <li>
            <strong>Review.</strong> A doctor opens it, sees the image beside
            the heatmap and the AI's reasoning, and records a decision with
            remarks. That decision travels back to the patient the same way.
          </li>

          <li>
            <strong>Report.</strong> Either side can produce a printable report
            carrying the patient's details, the grade, the images, the doctor's
            sign-off and the model's measured limits.
          </li>
        </ol>

      </section>

      <section className="about-section">

        <h2>The two ways in</h2>

        <h3>Retinal screening</h3>
        <p>
          The main path. It needs an actual photograph of the retina, which
          means a fundus camera or a clip-on lens in front of a phone. This is
          the path that produces a diabetic retinopathy grade.
        </p>

        <h3>Camera health check</h3>
        <p>
          For when no lens is available. A bare phone camera cannot photograph
          the retina, so instead this measures what a camera genuinely can see:
          pulse and heart-rate variability from a fingertip, how the pupil
          responds to light, and the colour of the inner eyelid. Combined with
          a short questionnaire it produces a referral priority - how soon
          someone should be seen - not a diagnosis.
        </p>

      </section>

      <section className="about-section">

        <h2>Explainability and the doctor's role</h2>

        <p>
          Every grade ships with a heatmap. This matters more than the grade:
          a model that is right for the wrong reasons is not usable, and the
          heatmap is what lets a clinician check the reasoning rather than
          trust a number. Every result also carries the model's measured
          performance, so nobody has to guess how much weight it deserves.
        </p>

        <p>
          No result is final until a doctor signs it off. The AI orders the
          queue and shows its working; the clinician decides.
        </p>

        <div className="page-actions">
          <Link className="action-button" to="/ai-screening">
            How the AI works, and how accurate it is
          </Link>

          <Link className="nav-button" to="/patient/screening">
            Start a screening
          </Link>
        </div>

      </section>

    </div>
  );
}

export default AboutPage;
