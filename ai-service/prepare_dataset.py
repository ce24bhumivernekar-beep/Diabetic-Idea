import os
import shutil
import pandas as pd
from sklearn.model_selection import train_test_split

# -----------------------------
# Paths
# -----------------------------

CSV_PATH = "data/train.csv"
IMAGE_DIR = "data/train_images"

OUTPUT_DIR = "data/processed"

# -----------------------------
# Read labels
# -----------------------------

df = pd.read_csv(CSV_PATH)

print("Dataset loaded.")
print("Number of images:", len(df))
print()
print("Class distribution:")
print(df["diagnosis"].value_counts().sort_index())

# -----------------------------
# Create output folders
# -----------------------------

for split in ["train", "validation", "test"]:

    for class_id in range(5):

        folder = os.path.join(
            OUTPUT_DIR,
            split,
            str(class_id)
        )

        os.makedirs(folder, exist_ok=True)

# -----------------------------
# Split dataset
# -----------------------------

train_df, temp_df = train_test_split(
    df,
    test_size=0.30,
    random_state=42,
    stratify=df["diagnosis"]
)

validation_df, test_df = train_test_split(
    temp_df,
    test_size=0.50,
    random_state=42,
    stratify=temp_df["diagnosis"]
)

print()
print("Train:", len(train_df))
print("Validation:", len(validation_df))
print("Test:", len(test_df))

# -----------------------------
# Copy images
# -----------------------------

def copy_images(dataframe, split_name):

    print()
    print(f"Preparing {split_name}...")

    for _, row in dataframe.iterrows():

        image_name = row["id_code"]
        diagnosis = row["diagnosis"]

        source = os.path.join(
            IMAGE_DIR,
            image_name + ".png"
        )

        destination = os.path.join(
            OUTPUT_DIR,
            split_name,
            str(diagnosis),
            image_name + ".png"
        )

        if os.path.exists(source):

            shutil.copy2(
                source,
                destination
            )

        else:

            print(
                "Image not found:",
                source
            )


copy_images(train_df, "train")
copy_images(validation_df, "validation")
copy_images(test_df, "test")

print()
print("===================================")
print("DATASET PREPARATION COMPLETE")
print("===================================")