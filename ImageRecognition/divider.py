import os
import shutil
from transformers import pipeline

# Define paths
input_dir = r"C:\Users\priti\Desktop\Builo\ImageRecognition\TrainingImages"
  # Relative path to the images
exterior_dir = os.path.join(input_dir, "Exterior")
interior_dir = os.path.join(input_dir, "Interior")

# Create output directories if they don't exist
os.makedirs(exterior_dir, exist_ok=True)
os.makedirs(interior_dir, exist_ok=True)

# Load model pipeline
print("⏳ Loading model...")
try:
    pipe = pipeline("image-classification", model="andupets/real-estate-image-classification")
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"❌ Model loading failed: {e}")
    exit()

# Define class categories
exterior_classes = {"house facade", "sao paulo apartment facade"}
interior_classes = {"bathroom", "bedroom", "dining room", "kitchen", "living room"}

# Process each image in the input directory
print("🔄 Processing images...")
file_count = 0

for filename in os.listdir(input_dir):
    file_path = os.path.join(input_dir, filename)

    # Skip directories
    if not os.path.isfile(file_path):
        print(f"Skipping {filename} (not a file)")
        continue

    try:
        # Predict category
        result = pipe(file_path)

        # Check if result is valid
        if not result or not isinstance(result, list):
            print(f"❌ Invalid prediction result for {filename}: {result}")
            continue

        predicted_class = result[0]["label"].lower()  # Get top predicted class
        print(f"{filename}: Predicted - {predicted_class}")

        # Move the image to the appropriate folder
        if predicted_class in exterior_classes:
            shutil.move(file_path, os.path.join(exterior_dir, filename))
            print(f"✅ Moved {filename} → Exterior")
        elif predicted_class in interior_classes:
            shutil.move(file_path, os.path.join(interior_dir, filename))
            print(f"✅ Moved {filename} → Interior")
        else:
            print(f"⚠️ Skipping {filename}: Unrecognized category '{predicted_class}'")

        file_count += 1

    except Exception as e:
        print(f"❌ Error processing {filename}: {e}")

# Final status update
if file_count > 0:
    print(f"✅ Image segregation complete! Processed {file_count} images.")
else:
    print("⚠️ No images were processed. Check the folder path and file format.")
