"""
Is this image gradable, and is there an eye in it at all?

A screening model will confidently grade a black frame, a thumb over the lens,
or a photograph so blurred that no microaneurysm could possibly be visible.
That is the most dangerous failure mode a screening tool has: a confident
"No DR" on an image nobody could have graded sends someone away reassured.
Real screening programmes reject 10-20% of images as ungradable, and this is
the gate that lets this one do the same.

It is deliberately classical computer vision, not a second neural network:
every number below is inspectable, needs no training data, and costs about a
millisecond, which is what lets the same code run on every frame of the live
viewfinder to tell the patient how to move.

    assess(image) -> {
      eyeDetected, gradable, quality 0-100, reasons[], guidance,
      metrics{ coverage, centering, focus, brightness, contrast, saturated }
    }
"""

import cv2
import numpy as np

# Thresholds below are measured from real fundus photographs rather than
# guessed: the first version rejected genuine images as "washed out" because
# its contrast floor sat above what a real retina actually produces.

# A retina has to fill a reasonable share of the frame to be gradable at all.
MIN_COVERAGE = 0.06

# Retina is strongly red-dominant (R-B of 18-110 measured); noise, skin and
# grey surfaces sit near zero. This is what stops the model grading a picture
# of nothing.
REDNESS_FLOOR = 10.0

# Any real photograph has texture. A flat fill - a thumb over the lens, a wall -
# has almost none, and would otherwise pass every other test.
TEXTURE_FLOOR = 3.0

# Retinal detail lives in the green channel; below this the vessels are gone.
FOCUS_FLOOR = 12.0
FOCUS_GOOD = 45.0

# Outside this the image is under- or over-exposed beyond recovery. Real
# fundus images measured 104-121, so 185 leaves generous headroom.
BRIGHTNESS_FLOOR = 25.0
BRIGHTNESS_CEILING = 185.0

# Measured 18-20 on real fundus images, so the floor sits below that.
CONTRAST_FLOOR = 12.0

# Fraction of blown-out pixels that ruins a reading. Real images measured 0%;
# a frame with 2.5% blown out and a mean of 222 is already unusable.
SATURATION_LIMIT = 0.05

# How far off-centre the disc may sit, as a fraction of the frame's half-width.
CENTERING_LIMIT = 0.35


# Anything above this is imaged retina; below it is the black surround the
# camera leaves outside the lens aperture.
SURROUND_LEVEL = 22


def _find_disc(gray):
    """
    Locate the illuminated area of retina.

    A fixed low threshold, not Otsu. Otsu picks the split that best separates
    two populations, and on a fundus photograph the strongest split is inside
    the retina - bright optic disc or laser scarring against darker macula -
    so it returned a fragment of the retina rather than the retina, and the
    framing advice built on it was wrong.
    """

    blurred = cv2.GaussianBlur(gray, (9, 9), 0)

    _, mask = cv2.threshold(
        blurred, SURROUND_LEVEL, 255, cv2.THRESH_BINARY
    )

    # Close small gaps so vessels and lesions do not split the disc.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return None, mask

    biggest = max(contours, key=cv2.contourArea)

    area = cv2.contourArea(biggest)

    if area <= 0:
        return None, mask

    (x, y), radius = cv2.minEnclosingCircle(biggest)

    # How much of that circle is actually filled: a real fundus disc is round,
    # a hand or a bright window edge is not.
    circularity = area / (np.pi * radius * radius) if radius > 0 else 0.0

    return {
        "center": (float(x), float(y)),
        "radius": float(radius),
        "area": float(area),
        "circularity": float(circularity),
    }, mask


# Every measurement is taken at this size. Sharpness measures like the
# variance of the Laplacian scale with resolution, so the same photograph
# judged at 224px and at 1411px would otherwise get two different verdicts -
# and the live viewfinder and the saved screening send exactly those two
# sizes.
WORKING_EDGE = 512


def assess(image_bgr):
    """Judge one frame. Cheap enough to run on every frame of a live preview."""

    if image_bgr is None or image_bgr.size == 0:
        return {
            "eyeDetected": False,
            "gradable": False,
            "quality": 0,
            "reasons": ["No image."],
            "guidance": "No image from the camera.",
            "metrics": {},
        }

    # Normalise the size before measuring anything.
    longest = max(image_bgr.shape[:2])

    if longest != WORKING_EDGE:
        scale = WORKING_EDGE / float(longest)

        image_bgr = cv2.resize(
            image_bgr,
            (
                max(1, int(image_bgr.shape[1] * scale)),
                max(1, int(image_bgr.shape[0] * scale)),
            ),
            interpolation=cv2.INTER_AREA,
        )

    height, width = image_bgr.shape[:2]
    frame_area = float(height * width)

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    disc, _ = _find_disc(gray)

    reasons = []

    coverage = (disc["area"] / frame_area) if disc else 0.0

    # ------------------------------------------------------------------
    # Is there an eye at all?
    # ------------------------------------------------------------------

    # Circularity is deliberately not a gate: many datasets ship fundus images
    # already cropped square, where the retina fills the frame and no circle
    # is visible at all. Colour and texture identify a retina in both cases.
    channels = image_bgr.reshape(-1, 3).mean(axis=0)
    redness = float(channels[2] - channels[0])

    texture = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    eye_detected = bool(
        disc
        and coverage >= MIN_COVERAGE
        and redness >= REDNESS_FLOOR
        and texture >= TEXTURE_FLOOR
    )

    if not eye_detected:
        return {
            "eyeDetected": False,
            "gradable": False,
            "quality": 0,
            "reasons": ["No retina visible in the frame."],
            "guidance": (
                "No eye detected - line the lens up with the eye and hold it "
                "steady."
            ),
            "metrics": {
                "coverage": round(coverage, 3),
                "redness": round(redness, 1),
                "texture": round(texture, 1),
                "circularity": round(disc["circularity"], 3) if disc else 0.0,
            },
        }

    # ------------------------------------------------------------------
    # Measure only inside the disc; the dark surround would skew everything
    # ------------------------------------------------------------------

    # Two kinds of fundus image arrive here: one with the retina as a lit disc
    # inside a black surround, and one already cropped so the retina fills the
    # frame. On the second kind Otsu latches onto the brightest patch - an
    # optic disc or laser scarring - and the "disc" is neither the retina nor
    # centred, so framing advice would be nonsense.
    dark_surround = float((gray < 40).mean())

    fills_frame = dark_surround < 0.15

    if fills_frame:
        inside = np.ones(gray.shape, dtype=bool)
    else:
        disc_mask = np.zeros(gray.shape, dtype=np.uint8)

        cv2.circle(
            disc_mask,
            (int(disc["center"][0]), int(disc["center"][1])),
            int(disc["radius"] * 0.85),
            255,
            -1,
        )

        inside = disc_mask > 0

        if not inside.any():
            inside = np.ones(gray.shape, dtype=bool)

    # Green channel carries retinal detail; red saturates, blue is noise.
    green = image_bgr[:, :, 1]

    focus = float(cv2.Laplacian(green, cv2.CV_64F).var())
    brightness = float(gray[inside].mean())
    contrast = float(green[inside].std())
    saturated = float((gray[inside] > 250).mean())

    offset = np.hypot(
        disc["center"][0] - width / 2.0,
        disc["center"][1] - height / 2.0,
    )

    centering = float(offset / (min(width, height) / 2.0))

    # ------------------------------------------------------------------
    # Verdict, with the reason and what to do about it
    # ------------------------------------------------------------------

    guidance = "Hold steady."

    if brightness < BRIGHTNESS_FLOOR:
        reasons.append(f"Too dark (brightness {brightness:.0f}).")
        guidance = "Too dark - add light or move closer."
    elif brightness > BRIGHTNESS_CEILING or saturated > SATURATION_LIMIT:
        reasons.append(
            f"Over-exposed ({saturated * 100:.0f}% of the retina blown out)."
        )
        guidance = "Too bright - reduce the light or pull back slightly."

    if focus < FOCUS_FLOOR:
        reasons.append(f"Out of focus (detail {focus:.0f}).")
        guidance = "Out of focus - adjust the distance slowly until vessels sharpen."

    if contrast < CONTRAST_FLOOR:
        reasons.append(f"Washed out (contrast {contrast:.0f}).")
        if guidance == "Hold steady.":
            guidance = "Low contrast - reduce glare on the lens."

    # Framing advice only applies when there is a visible surround to frame
    # against - on a frame-filling image it is already as framed as it gets.
    if not fills_frame:
        if coverage < 0.12:
            reasons.append("The retina fills too little of the frame.")
            guidance = "Move closer until the retina fills the circle."

        if centering > CENTERING_LIMIT:
            reasons.append("The retina is off-centre.")
            guidance = "Centre the retina inside the circle."

    gradable = len(reasons) == 0

    # A single number for the UI, built from the parts that actually matter.
    focus_score = min(1.0, focus / FOCUS_GOOD)
    exposure_score = 1.0 - min(1.0, abs(brightness - 125.0) / 125.0)
    framing_score = (
        1.0
        if fills_frame
        else max(0.0, 1.0 - centering / CENTERING_LIMIT)
    )

    coverage_score = 1.0 if fills_frame else min(1.0, coverage / 0.30)

    quality = int(
        round(
            100
            * (
                0.40 * focus_score
                + 0.25 * exposure_score
                + 0.20 * coverage_score
                + 0.15 * framing_score
            )
        )
    )

    if gradable:
        guidance = "Good - hold still and save the scan."

    return {
        "eyeDetected": True,
        "gradable": gradable,
        "quality": quality,
        "reasons": reasons,
        "guidance": guidance,
        "metrics": {
            "coverage": round(coverage, 3),
            "centering": round(centering, 3),
            "focus": round(focus, 1),
            "brightness": round(brightness, 1),
            "contrast": round(contrast, 1),
            "saturated": round(saturated, 4),
            "redness": round(redness, 1),
            "fillsFrame": fills_frame,
            "circularity": round(disc["circularity"], 3),
        },
    }
