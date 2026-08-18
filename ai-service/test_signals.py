"""
Accuracy checks for the camera-only measurements.

Each test builds a signal whose answer is known in advance and asks how close
the estimate lands. Run:

    venv\\Scripts\\python test_signals.py
"""

import cv2
import numpy as np

from signals import analyze_pallor, analyze_plr, analyze_ppg

RESULTS = []


def check(name, passed, detail):
    RESULTS.append((name, passed, detail))
    print(f"{'PASS' if passed else 'FAIL'}  {name:<46} {detail}")


# ============================================================
# PPG
# ============================================================


def synth_ppg(bpm, seconds=30, fps=30, noise=0.02, drift=True, jitter_ms=0.0,
              seed=1):
    """A fingertip PPG: a pulse train, camera noise, and a slow brightness drift."""

    rng = np.random.default_rng(seed)

    frames = int(seconds * fps)
    times = np.arange(frames) / fps

    beat_period = 60.0 / bpm

    signal = np.zeros(frames)

    beat_time = 0.5

    while beat_time < seconds:

        wobble = rng.normal(0.0, jitter_ms / 1000.0) if jitter_ms else 0.0

        centre = beat_time + wobble

        # Systolic upstroke plus a dicrotic bump, roughly PPG-shaped.
        signal += np.exp(-((times - centre) ** 2) / (2 * 0.045 ** 2))
        signal += 0.35 * np.exp(-((times - centre - 0.22) ** 2) / (2 * 0.05 ** 2))

        beat_time += beat_period

    if drift:
        signal += 0.8 * np.sin(2 * np.pi * 0.05 * times)

    signal += rng.normal(0.0, noise, frames)

    # A finger on the lens sits near the top of the red channel range.
    return 200 + 6 * signal, (times * 1000).tolist()


def test_ppg_accuracy():

    errors = []

    for bpm in (48, 60, 72, 88, 110, 132):

        samples, stamps = synth_ppg(bpm, seed=bpm)

        result = analyze_ppg(samples, stamps)

        if not result.get("ok"):
            check(f"PPG {bpm} bpm", False, result.get("reason", ""))
            continue

        error = abs(result["heartRateBpm"] - bpm)
        errors.append(error)

        check(
            f"PPG {bpm} bpm",
            error <= 2.0,
            f"estimated {result['heartRateBpm']} bpm "
            f"(error {error:.1f}) quality {result['quality']}",
        )

    if errors:
        print(f"      mean absolute error across rates: {np.mean(errors):.2f} bpm")


def test_ppg_hrv():
    """More beat-to-beat jitter must produce a higher HRV reading."""

    steady, stamps = synth_ppg(72, jitter_ms=4, seed=7)
    variable, _ = synth_ppg(72, jitter_ms=45, seed=7)

    low = analyze_ppg(steady, stamps)
    high = analyze_ppg(variable, stamps)

    ok = (
        low.get("ok")
        and high.get("ok")
        and high["rmssdMs"] > low["rmssdMs"]
    )

    check(
        "PPG HRV separates steady from variable",
        bool(ok),
        f"rmssd {low.get('rmssdMs')} ms -> {high.get('rmssdMs')} ms",
    )


def test_ppg_rejects_rubbish():
    """Pure noise must be refused, not turned into a confident heart rate."""

    rng = np.random.default_rng(3)

    noise = 128 + rng.normal(0, 12, 900)
    stamps = (np.arange(900) / 30 * 1000).tolist()

    result = analyze_ppg(noise, stamps)

    refused = (not result.get("ok")) or (not result.get("reliable"))

    check(
        "PPG refuses a noise-only trace",
        bool(refused),
        f"ok={result.get('ok')} reliable={result.get('reliable')} "
        f"quality={result.get('quality')}",
    )


def test_ppg_too_short():

    samples, stamps = synth_ppg(72, seconds=1)

    result = analyze_ppg(samples, stamps)

    check(
        "PPG rejects a too-short recording",
        not result.get("ok"),
        result.get("reason", ""),
    )


# ============================================================
# PLR
# ============================================================


def synth_eye(pupil_mm, iris_mm=11.7, px_per_mm=18.0, size=256, seed=0):
    """
    A synthetic eye close-up: bright sclera, mid-grey iris, dark pupil,
    with a little noise and a corneal highlight.
    """

    rng = np.random.default_rng(seed)

    image = np.full((size, size, 3), 225, dtype=np.uint8)

    centre = (size // 2, size // 2)

    iris_radius = int(iris_mm * px_per_mm / 2)
    pupil_radius = int(pupil_mm * px_per_mm / 2)

    cv2.circle(image, centre, iris_radius, (95, 85, 80), -1)
    cv2.circle(image, centre, pupil_radius, (18, 16, 15), -1)

    # Corneal reflection: a small bright spot, as any torch-lit eye has.
    cv2.circle(
        image,
        (centre[0] + pupil_radius // 3, centre[1] - pupil_radius // 3),
        max(2, pupil_radius // 6),
        (250, 250, 250),
        -1,
    )

    noise = rng.normal(0, 4, image.shape)

    return np.clip(image.astype(float) + noise, 0, 255).astype(np.uint8)


def test_plr_scale_recovery():
    """The iris ruler must recover a known pupil size in millimetres."""

    errors = []

    for true_mm in (3.0, 4.5, 6.0, 7.5):

        frame = synth_eye(true_mm, seed=int(true_mm * 10))

        frames = [frame] * 10
        stamps = list(range(0, 1000, 100))

        result = analyze_plr(frames, stamps, light_on_index=2)

        if not result.get("ok"):
            check(f"PLR scale {true_mm} mm", False, result.get("reason", ""))
            continue

        measured = result["baselineMm"]
        error = abs(measured - true_mm)
        errors.append(error)

        check(
            f"PLR measures a {true_mm} mm pupil",
            error <= 0.6,
            f"measured {measured} mm (error {error:.2f} mm)",
        )

    if errors:
        print(f"      mean absolute error: {np.mean(errors):.2f} mm")


def test_plr_response():
    """A constricting pupil must produce amplitude and latency."""

    stamps = []
    frames = []

    # 6 frames dark-adapted at 6.0 mm, then constriction to 3.6 mm, then
    # partial recovery - a normal-looking reflex.
    sizes = (
        [6.0] * 6
        + [5.9, 5.4, 4.6, 4.0, 3.7, 3.6]
        + [3.7, 3.9, 4.1, 4.3]
    )

    for index, size in enumerate(sizes):
        frames.append(synth_eye(size, seed=index))
        stamps.append(index * 60)

    result = analyze_plr(frames, stamps, light_on_index=5)

    if not result.get("ok"):
        check("PLR detects a constriction", False, result.get("reason", ""))
        return

    expected_pct = (6.0 - 3.6) / 6.0 * 100.0

    close = abs(result["constrictionPercent"] - expected_pct) <= 8.0

    check(
        "PLR detects a constriction",
        bool(close and result["latencyMs"] is not None),
        f"constriction {result['constrictionPercent']}% "
        f"(true {expected_pct:.0f}%), latency {result['latencyMs']} ms, "
        f"recovery {result['recoveryPercent']}%",
    )

    check(
        "PLR flags the response as reliable",
        bool(result["reliable"]),
        f"coverage {result['frameCoverage']}",
    )


def test_plr_flat_response():
    """A pupil that does not move must not be reported as a reflex."""

    frames = [synth_eye(5.0, seed=index) for index in range(16)]
    stamps = [index * 60 for index in range(16)]

    result = analyze_plr(frames, stamps, light_on_index=5)

    unreliable = result.get("ok") and not result.get("reliable")

    check(
        "PLR marks a flat trace unreliable",
        bool(unreliable),
        f"constriction {result.get('constrictionPercent')}%",
    )


# ============================================================
# Pallor
# ============================================================


def synth_lid(conjunctiva_bgr, sclera_bgr=(235, 238, 240), size=200):

    image = np.zeros((size, size, 3), dtype=np.uint8)

    image[:, :] = sclera_bgr

    cv2.rectangle(image, (20, 110), (180, 180), conjunctiva_bgr, -1)

    return image


def test_pallor_ordering():
    """A paler conjunctiva must score higher than a red one."""

    red = synth_lid((70, 70, 205))
    pale = synth_lid((150, 150, 200))

    box_conjunctiva = (40, 125, 120, 40)
    box_sclera = (40, 20, 120, 50)

    red_result = analyze_pallor(red, box_conjunctiva, box_sclera)
    pale_result = analyze_pallor(pale, box_conjunctiva, box_sclera)

    ok = (
        red_result.get("ok")
        and pale_result.get("ok")
        and pale_result["pallorIndex"] > red_result["pallorIndex"]
    )

    check(
        "Pallor ranks pale above red",
        bool(ok),
        f"red {red_result.get('pallorIndex')} -> "
        f"pale {pale_result.get('pallorIndex')}",
    )


def test_pallor_white_balance():
    """
    The same tissue under a warm and a cool light must score nearly the same
    once the sclera has been used as the white reference.
    """

    neutral = synth_lid((70, 70, 195), (200, 205, 210))

    # A warm bulb lifts red and drops blue across the whole photo. Kept below
    # clipping, since a blown-out reference is refused by design.
    warm = np.clip(
        neutral.astype(float) * np.array([0.78, 0.96, 1.18]),
        0,
        255,
    ).astype(np.uint8)

    box_conjunctiva = (40, 125, 120, 40)
    box_sclera = (40, 20, 120, 50)

    a = analyze_pallor(neutral, box_conjunctiva, box_sclera)
    b = analyze_pallor(warm, box_conjunctiva, box_sclera)

    drift = abs(a["pallorIndex"] - b["pallorIndex"])

    check(
        "Pallor survives a change of lighting",
        drift <= 5.0,
        f"{a['pallorIndex']} vs {b['pallorIndex']} under warm light "
        f"(drift {drift:.1f})",
    )


def test_pallor_rejects_bad_reference():

    dark = synth_lid((70, 70, 205), (10, 10, 10))

    result = analyze_pallor(dark, (40, 125, 120, 40), (40, 20, 120, 50))

    check(
        "Pallor refuses a dark white-reference",
        not result.get("ok"),
        result.get("reason", ""),
    )


# ============================================================


if __name__ == "__main__":

    print("PPG")
    print("-" * 74)
    test_ppg_accuracy()
    test_ppg_hrv()
    test_ppg_rejects_rubbish()
    test_ppg_too_short()

    print()
    print("PUPILLARY LIGHT REFLEX")
    print("-" * 74)
    test_plr_scale_recovery()
    test_plr_response()
    test_plr_flat_response()

    print()
    print("CONJUNCTIVAL PALLOR")
    print("-" * 74)
    test_pallor_ordering()
    test_pallor_white_balance()
    test_pallor_rejects_bad_reference()

    passed = sum(1 for _, ok, _ in RESULTS if ok)

    print()
    print("=" * 74)
    print(f"{passed}/{len(RESULTS)} checks passed")

    if passed != len(RESULTS):
        raise SystemExit(1)
