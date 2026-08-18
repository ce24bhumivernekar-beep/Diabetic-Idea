"""
Camera-only physiological measurements.

None of this needs a fundus lens: every signal here comes from an ordinary
phone camera. What it does NOT do is see the retina - that still needs
optics. These measurements support triage (who needs a retinal exam first),
they do not replace it.

  analyze_ppg     fingertip on the lens with the torch on -> heart rate and
                  heart-rate variability. Reduced HRV is a marker of cardiac
                  autonomic neuropathy in diabetes.

  analyze_plr     video of the eye while the torch fires -> pupil constriction
                  amplitude, latency and recovery. A blunted, slow pupil
                  response is an early sign of autonomic neuropathy.
                  Pixel sizes are converted to millimetres using the iris as a
                  built-in ruler: the horizontal visible iris diameter is
                  11.7 mm in adults with little variation.

  analyze_pallor  photo of the lower eyelid -> a conjunctival pallor index,
                  white-balanced against the sclera in the same frame.
                  Deliberately reported as an index, NOT as g/dL: converting
                  it to haemoglobin requires calibration against lab values
                  that this project does not have yet.

Every function returns a `quality` block. A measurement that cannot be trusted
says so instead of returning a confident-looking number.
"""

import numpy as np

# The horizontal visible iris diameter, in millimetres. Stable across adults
# (11.7 +/- 0.4 mm), which makes it a usable scale reference in any photo.
IRIS_DIAMETER_MM = 11.7

# Physiological bounds - anything outside these is a measurement failure,
# not a finding.
MIN_BPM = 40.0
MAX_BPM = 200.0


# ============================================================
# PPG - heart rate and variability
# ============================================================


def _bandpass(values, fps, low_hz, high_hz):
    """
    Zero-phase band-pass via FFT. The signal is a few thousand samples at
    most, so an FFT filter is simpler and more predictable here than
    designing an IIR filter, and it introduces no phase shift to distort the
    beat timing.
    """

    count = len(values)

    spectrum = np.fft.rfft(values)
    frequencies = np.fft.rfftfreq(count, d=1.0 / fps)

    spectrum[(frequencies < low_hz) | (frequencies > high_hz)] = 0

    return np.fft.irfft(spectrum, n=count)


def _detect_peaks(values, fps, expected_bpm=None, max_bpm=MAX_BPM):
    """
    Peak picking with a refractory period.

    The refractory window is derived from the rate the spectrum already
    suggests, not from the fastest heart rate imaginable. A PPG beat carries a
    dicrotic bump about 0.2 s after the systolic peak; with a fixed 0.3 s
    window that bump is counted as a second beat at low heart rates, which
    reports 60 bpm as roughly 85.
    """

    min_distance = int(fps * 60.0 / max_bpm)

    if expected_bpm and expected_bpm > 0:
        min_distance = max(
            min_distance,
            int(0.6 * fps * 60.0 / expected_bpm),
        )

    threshold = np.percentile(values, 60)

    peaks = []

    for index in range(1, len(values) - 1):

        if values[index] < threshold:
            continue

        if (values[index] < values[index - 1]
                or values[index] <= values[index + 1]):
            continue

        if peaks and index - peaks[-1] < min_distance:

            # Keep the taller of two peaks inside the refractory window.
            if values[index] > values[peaks[-1]]:
                peaks[-1] = index

            continue

        peaks.append(index)

    return np.array(peaks, dtype=int)


def analyze_ppg(samples, timestamps_ms=None):
    """
    samples       per-frame mean of the red channel while a fingertip covers
                  the camera. The browser computes these, so only a few
                  hundred numbers travel instead of a video.
    timestamps_ms per-frame timestamps; used to derive the true frame rate,
                  which phone cameras do not hold exactly.
    """

    values = np.asarray(samples, dtype=float)

    if values.size < 60:
        return {
            "ok": False,
            "reason": "Not enough frames. Hold still for at least 20 seconds.",
        }

    if timestamps_ms is not None and len(timestamps_ms) == len(values):

        stamps = np.asarray(timestamps_ms, dtype=float)

        duration_s = (stamps[-1] - stamps[0]) / 1000.0

        fps = (len(stamps) - 1) / duration_s if duration_s > 0 else 30.0

    else:

        fps = 30.0
        duration_s = len(values) / fps

    if fps < 5 or fps > 120:
        return {
            "ok": False,
            "reason": f"Unusable frame rate ({fps:.1f} fps).",
        }

    # A finger pressed on the lens gives a bright, almost constant red level;
    # the pulse is a small ripple on top. Remove the mean and any linear drift,
    # then let the band-pass deal with the rest.
    #
    # Note: subtracting a one-second moving average here would be a ~1 Hz
    # high-pass, which sits inside the heart-rate band and silently pulls every
    # estimate towards 75 bpm.
    trend = np.polyval(
        np.polyfit(np.arange(values.size), values, 1),
        np.arange(values.size),
    )

    detrended = values - trend

    filtered = _bandpass(
        detrended,
        fps,
        MIN_BPM / 60.0,
        MAX_BPM / 60.0,
    )

    spectrum = np.abs(np.fft.rfft(detrended)) ** 2
    frequencies = np.fft.rfftfreq(len(detrended), d=1.0 / fps)

    band = (frequencies >= MIN_BPM / 60.0) & (frequencies <= MAX_BPM / 60.0)

    band_power = spectrum[band].sum()

    # Dominant frequency is a robust heart-rate estimate on its own, and it
    # cross-checks the beat-to-beat result.
    if band.any():
        dominant_hz = float(frequencies[band][np.argmax(spectrum[band])])
    else:
        dominant_hz = 0.0

    # Signal quality = how concentrated the band is around that one frequency.
    #
    # Measuring the share of power inside the whole heart-rate band instead
    # would be useless here: broadband noise fills that band too, and scores
    # higher than a clean pulse whose energy sits in a single narrow line.
    if dominant_hz > 0 and band_power > 0:

        peak_region = (
            (np.abs(frequencies - dominant_hz) <= 0.15)
            | (np.abs(frequencies - 2 * dominant_hz) <= 0.15)
        ) & band

        quality = float(spectrum[peak_region].sum() / band_power)

    else:
        quality = 0.0

    spectral_bpm = dominant_hz * 60.0

    peaks = _detect_peaks(filtered, fps, expected_bpm=spectral_bpm)

    if len(peaks) < 4:
        return {
            "ok": False,
            "reason": "No clear pulse found. Cover the lens fully and keep still.",
            "quality": round(quality, 3),
        }

    intervals_ms = np.diff(peaks) / fps * 1000.0

    # Drop physiologically impossible intervals before deriving variability,
    # otherwise one missed beat inflates every HRV number.
    plausible = (intervals_ms > 60000.0 / MAX_BPM) & (
        intervals_ms < 60000.0 / MIN_BPM
    )

    intervals_ms = intervals_ms[plausible]

    if intervals_ms.size < 3:
        return {
            "ok": False,
            "reason": "Pulse too irregular to measure. Try again.",
            "quality": round(quality, 3),
        }

    mean_interval = float(np.mean(intervals_ms))

    peak_bpm = 60000.0 / mean_interval

    successive = np.diff(intervals_ms)

    rmssd = float(np.sqrt(np.mean(successive ** 2)))
    sdnn = float(np.std(intervals_ms, ddof=1))

    # The two independent estimates should agree; if they do not, the trace is
    # probably corrupted by movement or the beat detector has latched onto the
    # wrong feature. The spectrum is the more robust of the two, so it wins the
    # heart rate, and the beat-to-beat numbers are marked untrustworthy.
    agreement = abs(peak_bpm - spectral_bpm)

    beats_agree = (
        spectral_bpm > 0
        and agreement / spectral_bpm <= 0.15
    )

    heart_rate = peak_bpm if beats_agree else spectral_bpm

    return {
        "ok": True,
        "heartRateBpm": round(heart_rate, 1),
        "beatDetectedBpm": round(peak_bpm, 1),
        "spectralBpm": round(spectral_bpm, 1),
        "beats": int(len(peaks)),
        "durationSeconds": round(duration_s, 1),
        "fps": round(fps, 1),
        "sdnnMs": round(sdnn, 1),
        "rmssdMs": round(rmssd, 1),
        "meanIntervalMs": round(mean_interval, 1),
        "quality": round(quality, 3),
        "agreementBpm": round(agreement, 1),
        # Heart rate survives a mediocre trace; variability does not, because
        # it depends on the exact position of every beat.
        "reliable": bool(beats_agree and quality > 0.35),
        "hrvReliable": bool(
            beats_agree and quality > 0.50 and intervals_ms.size >= 10
        ),
    }


# ============================================================
# Pupillary light reflex
# ============================================================


def _measure_pupil(frame_bgr):
    """
    Finds the pupil and the iris in one eye close-up.

    The pupil is the darkest connected region near the centre; the iris is
    the surrounding ring, which is still much darker than the sclera. Both
    are found by thresholding on brightness, which is stable enough for a
    torch-lit close-up and needs no training data.

    Returns (pupil_px, iris_px) as diameters, or (None, None).
    """

    import cv2

    if frame_bgr is None or frame_bgr.size == 0:
        return None, None

    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)

    gray = cv2.GaussianBlur(gray, (7, 7), 0)

    height, width = gray.shape

    # Work on the central area: the lids and lashes sit at the edges.
    margin_y = int(height * 0.15)
    margin_x = int(width * 0.15)

    centre = gray[margin_y:height - margin_y, margin_x:width - margin_x]

    if centre.size == 0:
        return None, None

    def otsu(values_1d):
        """Otsu's threshold on a 1-D intensity array."""

        histogram, edges = np.histogram(values_1d, bins=64, range=(0, 256))

        histogram = histogram.astype(float)

        total = histogram.sum()

        if total == 0:
            return 128.0

        probabilities = histogram / total
        centres = (edges[:-1] + edges[1:]) / 2.0

        weight_background = np.cumsum(probabilities)
        weight_foreground = 1.0 - weight_background

        mean_background = np.cumsum(probabilities * centres)
        mean_total = mean_background[-1]

        with np.errstate(invalid="ignore", divide="ignore"):
            between = (
                (mean_total * weight_background - mean_background) ** 2
                / (weight_background * weight_foreground)
            )

        between = np.nan_to_num(between)

        return float(centres[int(np.argmax(between))])

    def largest_blob(mask):

        contours, _ = cv2.findContours(
            mask.astype(np.uint8),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        if not contours:
            return None

        biggest = max(contours, key=cv2.contourArea)

        area = cv2.contourArea(biggest)

        if area <= 0:
            return None

        # Equivalent-circle diameter is more stable than a bounding box when
        # the lid clips the top of the pupil.
        return float(2.0 * np.sqrt(area / np.pi))

    # An eye close-up has three brightness populations: pupil, iris, sclera.
    # A fixed percentile cannot separate them, because the pupil covers a very
    # different share of the frame at 3 mm than at 7 mm. Two Otsu passes adapt
    # to whatever is actually in the picture:
    #   pass 1  sclera  vs  (iris + pupil)
    #   pass 2  iris    vs  pupil, inside the dark part only
    iris_cut = otsu(centre.ravel())

    dark_pixels = centre[centre <= iris_cut]

    iris_diameter = largest_blob(centre <= iris_cut)

    if dark_pixels.size < 20:
        return None, iris_diameter

    pupil_cut = otsu(dark_pixels)

    pupil_diameter = largest_blob(centre <= pupil_cut)

    return pupil_diameter, iris_diameter


def analyze_plr(frames_bgr, timestamps_ms, light_on_index=0):
    """
    frames_bgr       list of decoded eye close-ups, in capture order
    timestamps_ms    capture time of each frame
    light_on_index   index of the frame where the torch fired

    Returns the constriction amplitude, latency and recovery, in millimetres
    and milliseconds, using the iris as the scale reference.
    """

    if len(frames_bgr) < 8:
        return {
            "ok": False,
            "reason": "Too few frames for a pupil response.",
        }

    pupils = []
    irises = []

    for frame in frames_bgr:
        pupil, iris = _measure_pupil(frame)
        pupils.append(pupil)
        irises.append(iris)

    valid = [
        index
        for index, value in enumerate(pupils)
        if value is not None and irises[index] not in (None, 0)
    ]

    if len(valid) < 8:
        return {
            "ok": False,
            "reason": "Could not find the pupil. Fill the frame with one eye.",
        }

    # One scale for the whole clip: the iris does not change size, so its
    # median measurement is the most reliable reference available.
    iris_px = float(np.median([irises[index] for index in valid]))

    if iris_px <= 0:
        return {"ok": False, "reason": "Could not measure the iris."}

    mm_per_px = IRIS_DIAMETER_MM / iris_px

    times = np.asarray(
        [float(timestamps_ms[index]) for index in valid],
        dtype=float,
    )

    diameters_mm = np.asarray(
        [pupils[index] * mm_per_px for index in valid],
        dtype=float,
    )

    light_time = float(timestamps_ms[
        min(light_on_index, len(timestamps_ms) - 1)
    ])

    before = diameters_mm[times <= light_time]
    after = diameters_mm[times > light_time]

    if before.size < 2 or after.size < 4:
        return {
            "ok": False,
            "reason": "Need frames both before and after the light.",
        }

    baseline_mm = float(np.median(before))

    minimum_index = int(np.argmin(after))
    minimum_mm = float(after[minimum_index])

    constriction_pct = (
        (baseline_mm - minimum_mm) / baseline_mm * 100.0
        if baseline_mm > 0
        else 0.0
    )

    times_after = times[times > light_time]

    # Latency: first frame where the pupil has moved 10% of the way to its
    # minimum - a fixed fraction rather than an absolute size, so it does not
    # depend on how large the pupil started.
    trigger = baseline_mm - 0.10 * (baseline_mm - minimum_mm)

    latency_ms = None

    for position, value in enumerate(after):
        if value <= trigger:
            latency_ms = float(times_after[position] - light_time)
            break

    time_to_min_ms = float(times_after[minimum_index] - light_time)

    # Recovery: how far back towards baseline the pupil came by the end.
    tail = after[minimum_index:]

    recovery_pct = (
        (float(tail[-1]) - minimum_mm) / (baseline_mm - minimum_mm) * 100.0
        if tail.size > 1 and baseline_mm > minimum_mm
        else 0.0
    )

    coverage = len(valid) / float(len(frames_bgr))

    return {
        "ok": True,
        "baselineMm": round(baseline_mm, 2),
        "minimumMm": round(minimum_mm, 2),
        "constrictionPercent": round(constriction_pct, 1),
        "latencyMs": round(latency_ms, 1) if latency_ms is not None else None,
        "timeToMinimumMs": round(time_to_min_ms, 1),
        "recoveryPercent": round(max(0.0, min(recovery_pct, 100.0)), 1),
        "irisPx": round(iris_px, 1),
        "mmPerPx": round(mm_per_px, 5),
        "framesUsed": len(valid),
        "frameCoverage": round(coverage, 2),
        # A real reflex constricts clearly; anything less is usually a
        # tracking failure rather than a clinical finding.
        "reliable": bool(coverage > 0.7 and constriction_pct > 5.0),
    }


# ============================================================
# Conjunctival pallor
# ============================================================


def analyze_pallor(image_bgr, conjunctiva_box, sclera_box):
    """
    image_bgr        photo of the everted lower lid
    conjunctiva_box  (x, y, w, h) over the red inner lid
    sclera_box       (x, y, w, h) over nearby white sclera

    The sclera is close to neutral white, so it serves as an in-frame grey
    card: dividing by it removes the phone's white balance and the ambient
    light colour, which is what usually ruins colour measurements taken on
    different devices.

    Reported as an index from 0 (deep red, well perfused) to 100 (pale).
    NOT haemoglobin - see the module docstring.
    """

    if image_bgr is None or image_bgr.size == 0:
        return {"ok": False, "reason": "No image."}

    def patch(box):

        x, y, w, h = (int(value) for value in box)

        x = max(0, x)
        y = max(0, y)

        region = image_bgr[y:y + h, x:x + w]

        if region.size == 0:
            return None

        # Median resists specular highlights, which are common on a wet eye.
        return np.median(
            region.reshape(-1, 3).astype(float),
            axis=0,
        )

    conjunctiva = patch(conjunctiva_box)
    sclera = patch(sclera_box)

    if conjunctiva is None or sclera is None:
        return {
            "ok": False,
            "reason": "Selection is outside the photo.",
        }

    if np.any(sclera < 20):
        return {
            "ok": False,
            "reason": "The white reference is too dark. Use more light.",
        }

    if np.any(sclera >= 253):
        return {
            "ok": False,
            "reason": "The white reference is blown out. Reduce the light.",
        }

    # White balance against the sclera.
    balanced = conjunctiva / sclera

    blue, green, red = balanced

    # Redness after balancing: a well perfused conjunctiva keeps far more red
    # than green. Pale tissue moves the ratio towards 1.
    if green <= 0:
        return {"ok": False, "reason": "Unusable colour reading."}

    redness = float(red / green)

    # Map a plausible redness span onto 0-100. The span is a starting point
    # to be replaced once paired lab values exist.
    lower, upper = 1.0, 2.2

    pallor_index = (upper - redness) / (upper - lower) * 100.0

    pallor_index = float(max(0.0, min(100.0, pallor_index)))

    return {
        "ok": True,
        "pallorIndex": round(pallor_index, 1),
        "rednessRatio": round(redness, 3),
        "balancedRgb": [round(float(value), 3) for value in balanced[::-1]],
        "calibrated": False,
        "note": (
            "Uncalibrated index, not a haemoglobin value. Needs paired lab "
            "results before it can report g/dL."
        ),
        "reliable": True,
    }
