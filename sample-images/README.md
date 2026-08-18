# Sample retinal fundus images

Real fundus photographs for exercising the screening flow. Not training data —
for training, use the APTOS 2019 dataset as described in the root README.

| File | Content | Source | Licence |
|---|---|---|---|
| `normal_right_eye.jpg` | healthy retina, right eye (1411×1411) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fundus_photograph_of_normal_right_eye.jpg) | CC0 |
| `normal_left_eye.jpg` | healthy retina, left eye (1411×1411) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fundus_photograph_of_normal_left_eye.jpg) | CC0 |
| `diabetic_retinopathy_laser_treated.jpg` | diabetic retinopathy after scatter laser surgery (432×288) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Diabetic_retinopathy_laser_surgery-NEI.jpg), US National Eye Institute | Public domain |

The AI service accepts JPG and PNG up to 20MB and resizes to 224×224 internally,
so the original resolution does not matter.

Whatever grade comes back is meaningless while `/health` reports
`modelTrained: false` — the placeholder model has an untrained classification
head. The upload, Grad-CAM overlay, storage and doctor review are all real.
