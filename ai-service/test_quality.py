"""
Does the gradability gate accept usable fundus images and refuse the rest?

Real fundus photographs are used as the positive cases, then degraded in the
specific ways a screening camera actually fails: blur, darkness, glare, a
thumb over the lens, an off-centre eye.
"""

import cv2
import numpy as np

from quality import assess

RESULTS = []


def check(name, ok, detail):
    RESULTS.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name:<44} {detail}")


REAL = [
    r"Y:\SIH 2026\sample-images\normal_right_eye.jpg",
    r"Y:\SIH 2026\sample-images\normal_left_eye.jpg",
    r"Y:\SIH 2026\sample-images\diabetic_retinopathy_laser_treated.jpg",
]


def load(path, size=600):
    image = cv2.imread(path)
    return cv2.resize(image, (size, size))


print("REAL FUNDUS IMAGES SHOULD BE ACCEPTED")
for path in REAL:
    image = load(path)
    result = assess(image)
    check(
        path.split("\\")[-1][:34],
        result["eyeDetected"] and result["gradable"],
        f"eye={result['eyeDetected']} gradable={result['gradable']} "
        f"q={result['quality']} {result['reasons'][:1]}",
    )

print()
print("UNUSABLE FRAMES SHOULD BE REFUSED")

base = load(REAL[0])

blurred = cv2.GaussianBlur(base, (41, 41), 0)
result = assess(blurred)
check("heavy blur refused", not result["gradable"],
      f"q={result['quality']} focus={result['metrics'].get('focus')} -> {result['guidance'][:38]}")

dark = (base * 0.10).astype(np.uint8)
result = assess(dark)
check("near-black frame refused", not result["gradable"],
      f"eye={result['eyeDetected']} -> {result['guidance'][:38]}")

glare = np.clip(base.astype(np.int32) + 130, 0, 255).astype(np.uint8)
result = assess(glare)
check("blown-out frame refused", not result["gradable"],
      f"saturated={result['metrics'].get('saturated')} -> {result['guidance'][:34]}")

# a thumb over the lens: flat, featureless, filling the frame
thumb = np.full_like(base, 90)
thumb[:, :, 2] = 150
result = assess(thumb)
check("thumb over the lens refused", not result["gradable"],
      f"eye={result['eyeDetected']} -> {result['guidance'][:38]}")

black = np.zeros_like(base)
result = assess(black)
check("black frame: no eye detected", not result["eyeDetected"],
      result["guidance"][:44])

noise = np.random.default_rng(0).integers(0, 255, base.shape, dtype=np.uint8)
result = assess(noise)
check("random noise: not gradable", not result["gradable"],
      f"eye={result['eyeDetected']} q={result['quality']}")

print()
print("FRAMING FEEDBACK")

small = np.zeros_like(base)
tiny = cv2.resize(base, (160, 160))
small[220:380, 220:380] = tiny
result = assess(small)
check("retina too small in frame", not result["gradable"],
      f"coverage={result['metrics'].get('coverage')} -> {result['guidance'][:40]}")

shifted = np.zeros_like(base)
moved = cv2.resize(base, (420, 420))
shifted[0:420, 0:420] = moved
result = assess(shifted)
check("off-centre retina flagged", not result["gradable"],
      f"centering={result['metrics'].get('centering')} -> {result['guidance'][:36]}")

print()
passed = sum(1 for r in RESULTS if r)
print(f"{passed}/{len(RESULTS)} checks passed")

if passed != len(RESULTS):
    raise SystemExit(1)
