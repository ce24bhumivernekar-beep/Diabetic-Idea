import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const onPatient = () => navigate("/patient/screening");
  const onDoctor = () => navigate("/doctor/login");

  const [pointer, setPointer] = useState({
    x: 0,
    y: 0,
  });

  const target = useRef({
    x: 0,
    y: 0,
  });

  const current = useRef({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const handlePointerMove = (event) => {
      const x =
        (event.clientX / window.innerWidth - 0.5) * 2;

      const y =
        (event.clientY / window.innerHeight - 0.5) * 2;

      target.current = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      };
    };

    window.addEventListener(
      "mousemove",
      handlePointerMove
    );

    let animationFrame;

    const animate = () => {
      current.current.x +=
        (target.current.x - current.current.x) * 0.07;

      current.current.y +=
        (target.current.y - current.current.y) * 0.07;

      setPointer({
        x: current.current.x,
        y: current.current.y,
      });

      animationFrame =
        requestAnimationFrame(animate);
    };

    animationFrame =
      requestAnimationFrame(animate);

    return () => {
      window.removeEventListener(
        "mousemove",
        handlePointerMove
      );

      cancelAnimationFrame(animationFrame);
    };
  }, []);

  const irisX = pointer.x * 42;
  const irisY = pointer.y * 25;

  const eyeTiltX = pointer.y * -3;
  const eyeTiltY = pointer.x * 5;

  return (
    <div className="landing-page">

      {/* =====================================================
          NAVIGATION
         ===================================================== */}

      <header className="landing-nav">

        <Link className="landing-brand" to="/">
          RetiNova
        </Link>

        <nav className="landing-navigation">

          <Link className="landing-nav-item active" to="/">
            HOME
          </Link>

          <Link className="landing-nav-item" to="/patient/screening">
            SCREENING
          </Link>

          <Link className="landing-nav-item" to="/about#ai-analysis">
            AI ANALYSIS
          </Link>

          <Link className="landing-nav-item" to="/about">
            ABOUT
          </Link>

        </nav>

        <div className="landing-nav-right">

          <button
            className="landing-nav-doctor"
            onClick={onDoctor}
          >
            DOCTOR PORTAL
          </button>

          <button
            className="landing-menu"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            MENU

            <span className="menu-lines">
              <i />
              <i />
            </span>

          </button>

        </div>

        {menuOpen && (
          <div className="landing-mobile-menu" id="landing-mobile-menu">
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/patient/screening" onClick={() => setMenuOpen(false)}>Screening</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)}>About</Link>
            <Link to="/patient/login" onClick={() => setMenuOpen(false)}>Patient sign in</Link>
            <Link to="/doctor/login" onClick={() => setMenuOpen(false)}>Doctor portal</Link>
          </div>
        )}

      </header>

      {/* =====================================================
          HERO
         ===================================================== */}

      <main className="landing-hero">

        {/* LEFT CONTENT */}

        <section className="landing-left">

          <div className="landing-small-heading">
            YOUR HEALTH
          </div>

          <h1 className="landing-title">
            Empowering
            <br />
            healthcare
            <br />
            <span>with AI.</span>
          </h1>

          <div className="landing-title-detail">
            ◌
          </div>

          <div className="landing-feature-grid">

            <article className="landing-feature-card">

              <div className="feature-icon">
                +
              </div>

              <div>
                <h3>
                  Personalized Screening
                </h3>

                <p>
                  AI-powered retinal image
                  analysis for faster screening.
                </p>
              </div>

            </article>

            <article className="landing-feature-card">

              <div className="feature-icon">
                +
              </div>

              <div>
                <h3>
                  Explainable Results
                </h3>

                <p>
                  Clear visual results designed
                  for patients and doctors.
                </p>
              </div>

            </article>

            <article className="landing-feature-card">

              <div className="feature-icon">
                +
              </div>

              <div>
                <h3>
                  Early Detection
                </h3>

                <p>
                  Identify retinal abnormalities
                  before they become severe.
                </p>
              </div>

            </article>

            <article className="landing-feature-card">

              <div className="feature-icon">
                +
              </div>

              <div>
                <h3>
                  Clinical Review
                </h3>

                <p>
                  Give doctors an easy way to
                  review and confirm AI findings.
                </p>
              </div>

            </article>

          </div>

          <p className="landing-description">
            RetiNova combines artificial intelligence
            and retinal imaging to support faster,
            clearer diabetic retinopathy screening.
          </p>

          <div className="landing-actions">

            <button
              className="landing-primary"
              onClick={onPatient}
            >
              START SCREENING
              <span>→</span>
            </button>

            <button
              className="landing-secondary"
              onClick={onDoctor}
            >
              DOCTOR PORTAL
            </button>

          </div>

        </section>

        {/* ===================================================
            RIGHT SIDE
           =================================================== */}

        <section className="landing-right">

          <div className="landing-right-heading">
            INTERACTIVE RETINAL VISION
          </div>

          <div
            className="landing-eye-scene"
            style={{
              transform: `
                perspective(1200px)
                rotateX(${eyeTiltX}deg)
                rotateY(${eyeTiltY}deg)
              `,
            }}
          >

            <div className="eye-aura" />

            <svg
              className="landing-eye"
              viewBox="0 0 1000 620"
              aria-hidden="true"
            >

              <defs>

                <clipPath id="retinaEyeClip">
                  <path
                    d="
                      M 80 310
                      C 185 150,
                        340 82,
                        500 82
                      C 660 82,
                        815 150,
                        920 310
                      C 815 470,
                        660 538,
                        500 538
                      C 340 538,
                        185 470,
                        80 310
                      Z
                    "
                  />
                </clipPath>

                <radialGradient
                  id="scleraGradient"
                  cx="50%"
                  cy="50%"
                  r="70%"
                >
                  <stop
                    offset="0%"
                    stopColor="#ffffff"
                  />

                  <stop
                    offset="68%"
                    stopColor="#e7e7e7"
                  />

                  <stop
                    offset="100%"
                    stopColor="#c7c7c7"
                  />
                </radialGradient>

                <radialGradient
                  id="irisGradient"
                  cx="48%"
                  cy="44%"
                  r="62%"
                >
                  <stop
                    offset="0%"
                    stopColor="#12080a"
                  />

                  <stop
                    offset="25%"
                    stopColor="#321016"
                  />

                  <stop
                    offset="53%"
                    stopColor="#7b1c2c"
                  />

                  <stop
                    offset="75%"
                    stopColor="#ca364f"
                  />

                  <stop
                    offset="91%"
                    stopColor="#761322"
                  />

                  <stop
                    offset="100%"
                    stopColor="#2c090e"
                  />
                </radialGradient>

                <radialGradient
                  id="irisGlow"
                  cx="50%"
                  cy="50%"
                  r="60%"
                >
                  <stop
                    offset="0%"
                    stopColor="rgba(214,48,78,0.34)"
                  />

                  <stop
                    offset="65%"
                    stopColor="rgba(214,48,78,0.10)"
                  />

                  <stop
                    offset="100%"
                    stopColor="rgba(214,48,78,0)"
                  />
                </radialGradient>

                <linearGradient
                  id="lidGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor="#aaa"
                  />

                  <stop
                    offset="50%"
                    stopColor="#e5e5e5"
                  />

                  <stop
                    offset="100%"
                    stopColor="#aaa"
                  />
                </linearGradient>

                <filter
                  id="softBlur"
                  x="-40%"
                  y="-40%"
                  width="180%"
                  height="180%"
                >
                  <feGaussianBlur
                    stdDeviation="18"
                  />
                </filter>

                <filter
                  id="smallBlur"
                  x="-40%"
                  y="-40%"
                  width="180%"
                  height="180%"
                >
                  <feGaussianBlur
                    stdDeviation="3"
                  />
                </filter>

              </defs>

              <path
                d="
                  M 80 310
                  C 185 150,
                    340 82,
                    500 82
                  C 660 82,
                    815 150,
                    920 310
                  C 815 470,
                    660 538,
                    500 538
                  C 340 538,
                    185 470,
                    80 310
                  Z
                "
                fill="url(#scleraGradient)"
              />

              <ellipse
                cx="500"
                cy="310"
                rx="270"
                ry="185"
                fill="url(#irisGlow)"
                filter="url(#softBlur)"
                opacity="0.55"
                clipPath="url(#retinaEyeClip)"
              />

              <g
                clipPath="url(#retinaEyeClip)"
                style={{
                  transform: `
                    translate(
                      ${irisX}px,
                      ${irisY}px
                    )
                  `,
                  transformOrigin:
                    "500px 310px",
                  transition:
                    "transform 0.08s linear",
                }}
              >

                <circle
                  cx="500"
                  cy="310"
                  r="174"
                  fill="url(#irisGlow)"
                  filter="url(#smallBlur)"
                />

                <circle
                  cx="500"
                  cy="310"
                  r="127"
                  fill="url(#irisGradient)"
                />

                <circle
                  cx="500"
                  cy="310"
                  r="124"
                  fill="none"
                  stroke="rgba(255,255,255,0.32)"
                  strokeWidth="2"
                />

                <circle
                  cx="500"
                  cy="310"
                  r="112"
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />

                <g className="iris-texture">

                  <line
                    x1="500"
                    y1="185"
                    x2="500"
                    y2="255"
                  />

                  <line
                    x1="538"
                    y1="191"
                    x2="523"
                    y2="258"
                  />

                  <line
                    x1="573"
                    y1="209"
                    x2="548"
                    y2="264"
                  />

                  <line
                    x1="603"
                    y1="236"
                    x2="566"
                    y2="278"
                  />

                  <line
                    x1="620"
                    y1="274"
                    x2="575"
                    y2="290"
                  />

                  <line
                    x1="620"
                    y1="346"
                    x2="575"
                    y2="330"
                  />

                  <line
                    x1="603"
                    y1="384"
                    x2="566"
                    y2="342"
                  />

                  <line
                    x1="573"
                    y1="411"
                    x2="548"
                    y2="356"
                  />

                  <line
                    x1="538"
                    y1="429"
                    x2="523"
                    y2="362"
                  />

                  <line
                    x1="500"
                    y1="435"
                    x2="500"
                    y2="365"
                  />

                  <line
                    x1="462"
                    y1="429"
                    x2="477"
                    y2="362"
                  />

                  <line
                    x1="427"
                    y1="411"
                    x2="452"
                    y2="356"
                  />

                  <line
                    x1="397"
                    y1="384"
                    x2="434"
                    y2="342"
                  />

                  <line
                    x1="380"
                    y1="346"
                    x2="425"
                    y2="330"
                  />

                  <line
                    x1="380"
                    y1="274"
                    x2="425"
                    y2="290"
                  />

                  <line
                    x1="397"
                    y1="236"
                    x2="434"
                    y2="278"
                  />

                  <line
                    x1="427"
                    y1="209"
                    x2="452"
                    y2="264"
                  />

                  <line
                    x1="462"
                    y1="191"
                    x2="477"
                    y2="258"
                  />

                </g>

                <circle
                  cx="500"
                  cy="310"
                  r="93"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="2"
                />

                <circle
                  cx="500"
                  cy="310"
                  r="70"
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />

                <circle
                  cx="500"
                  cy="310"
                  r="52"
                  fill="#030303"
                />

                <circle
                  cx="500"
                  cy="310"
                  r="42"
                  fill="#000000"
                />

                <ellipse
                  cx="531"
                  cy="282"
                  rx="16"
                  ry="11"
                  fill="rgba(255,255,255,0.85)"
                />

                <circle
                  cx="549"
                  cy="299"
                  r="5"
                  fill="rgba(255,255,255,0.45)"
                />

              </g>

              <path
                d="
                  M 80 310
                  C 185 150,
                    340 82,
                    500 82
                  C 660 82,
                    815 150,
                    920 310
                "
                fill="none"
                stroke="url(#lidGradient)"
                strokeWidth="6"
              />

              <path
                d="
                  M 80 310
                  C 185 470,
                    340 538,
                    500 538
                  C 660 538,
                    815 470,
                    920 310
                "
                fill="none"
                stroke="rgba(110,110,110,0.45)"
                strokeWidth="4"
              />

            </svg>

            <div className="eye-orbit orbit-one" />
            <div className="eye-orbit orbit-two" />

          </div>

          <div className="eye-card eye-card-top">

            <span className="eye-card-dot" />

            <div>
              <strong>
                Retinal analysis
              </strong>

              <p>
                AI-assisted image interpretation
              </p>
            </div>

          </div>

          <div className="eye-card eye-card-middle">

            <span className="eye-card-dot green" />

            <div>
              <strong>
                Explainable AI
              </strong>

              <p>
                Visual evidence for review
              </p>
            </div>

          </div>

          <div className="eye-card eye-card-bottom">

            <span className="eye-card-dot" />

            <div>
              <strong>
                Clinical review
              </strong>

              <p>
                Doctor verification workflow
              </p>
            </div>

          </div>

          <div className="eye-cursor-note">
            MOVE YOUR CURSOR
          </div>

        </section>

      </main>

      {/* =====================================================
          BOTTOM STRIP
         ===================================================== */}

      <footer className="landing-bottom-strip">

        <div className="strip-number">
          01
        </div>

        <div className="strip-title">
          Early detection starts with
          better retinal screening.
        </div>

        <div className="strip-description">
          AI-assisted analysis can help
          surface retinal abnormalities
          for clinical review.
        </div>

        <button
          className="strip-button"
          onClick={onPatient}
        >
          START SCREENING →
        </button>

      </footer>

    </div>
  );
}

export default LandingPage;