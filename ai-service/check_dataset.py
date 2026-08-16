from pathlib import Path

base = Path("data/processed")

for split in ["train", "validation", "test"]:
    print(f"\n{split.upper()}")

    for class_id in ["0", "1", "2", "3", "4"]:
        folder = base / split / class_id
        count = len(list(folder.glob("*.png")))
        print(f"Class {class_id}: {count} images")