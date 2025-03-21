import base64
import csv
import os
import random
from fastapi.responses import JSONResponse
import numpy as np
import faiss
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query
from pymongo import MongoClient
import requests
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.efficientnet import preprocess_input
from io import BytesIO
from PIL import Image
from collections import defaultdict
import os
import random
import base64
import numpy as np
import faiss
import requests
from io import BytesIO
from fastapi import FastAPI, Form, HTTPException
from pymongo import MongoClient
from PIL import Image
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras.preprocessing.image import img_to_array

app = FastAPI()

# Initialize EfficientNetB3 for feature extraction
base_model = EfficientNetB3(weights="imagenet", include_top=False, pooling="avg", input_shape=(300, 300, 3))

# MongoDB Connection
MONGO_URI = "mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client["test"]
building_collection = db["buildings"]

# Initialize Faiss index (L2 normalized for better similarity search)
faiss_index = None
labels = []
file_paths = []

# Extract Features from Dataset
@app.post("/extract_features/")
async def extract_features(dataset_folder: str = Form(...), output_file: str = Form("features.npz")):
    global faiss_index, labels, file_paths
    try:
        if not os.path.exists(dataset_folder):
            raise HTTPException(status_code=400, detail=f"Dataset folder '{dataset_folder}' not found.")

        building_counts = defaultdict(int)
        image_files = [f for f in os.listdir(dataset_folder) if os.path.isfile(os.path.join(dataset_folder, f))]

        extracted_features = []
        extracted_labels = []
        extracted_file_paths = []

        for img_name in image_files:
            img_path = os.path.join(dataset_folder, img_name)
            building_name = " ".join(img_name.split()[:4])  # Extract first words as the building name

            img = image.load_img(img_path, target_size=(300, 300))
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = preprocess_input(img_array)

            feature = base_model.predict(img_array).flatten()
            feature /= np.linalg.norm(feature)  # L2 Normalize features

            extracted_features.append(feature)
            extracted_labels.append(building_name)
            extracted_file_paths.append(img_path)

            building_counts[building_name] += 1

        # Convert to numpy arrays
        extracted_features = np.array(extracted_features)
        extracted_labels = np.array(extracted_labels)
        extracted_file_paths = np.array(extracted_file_paths)

        # Save extracted features
        np.savez(output_file, features=extracted_features, labels=extracted_labels, file_paths=extracted_file_paths)

        # Initialize Faiss index
        faiss_index = faiss.IndexFlatL2(extracted_features.shape[1])
        faiss_index.add(extracted_features)

        # Store labels and file paths globally
        labels = extracted_labels.tolist()
        file_paths = extracted_file_paths.tolist()

        return {"message": f"Features extracted and saved to {output_file}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Load Features into Memory
@app.post("/load_features/")
async def load_features(file_path: str = Query(..., description="Path to the .npz file")):
    global faiss_index, labels, file_paths
    try:
        data = np.load(file_path)
        features = data["features"]
        labels = data["labels"].tolist()
        file_paths = data["file_paths"].tolist()

        if features is None or len(features) == 0:
            raise ValueError("Features are empty in the .npz file.")

        # Load features into Faiss index
        faiss_index = faiss.IndexFlatL2(features.shape[1])
        faiss_index.add(features)

        return {"message": f"Features loaded from {file_path}"}

    except Exception as e:
        return {"error": f"Error loading features from {file_path}: {e}"}


# Classify an Input Image
@app.post("/classify/")
async def classify(input_image: UploadFile = File(...), latitude: float = 0.0, longitude: float = 0.0):
    global faiss_index, labels, file_paths
    try:
        if faiss_index is None or len(labels) == 0:
            return {"detail": "Feature database is empty. Extract and load features first."}

        # Read and preprocess the input image
        image_data = await input_image.read()
        img = Image.open(BytesIO(image_data))

        if img.mode != "RGB":
            img = img.convert("RGB")

        img = img.resize((300, 300))
        img_array = np.array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)

        # Extract features
        input_feature = base_model.predict(img_array).flatten()
        input_feature /= np.linalg.norm(input_feature)  # Normalize

        # Search in Faiss
        _, best_match_idx = faiss_index.search(np.array([input_feature]), 1)
        best_match_idx = best_match_idx[0][0]

        return {
            "predicted_label": labels[best_match_idx],
            "file_path": file_paths[best_match_idx],
        }

    except Exception as e:
        return {"detail": str(e)}

@app.post("/test/")
async def test_model(num_tests: int = Form(20), crop_ratio: float = Form(0.2), rotation_range: int = Form(45)):
    global faiss_index, labels, file_paths
    try:
        if faiss_index is None or len(labels) == 0:
            raise HTTPException(status_code=400, detail="Feature database is empty. Load features first.")

        # Load features from stored .npz file
        data = np.load("features.npz")
        labels_list = data["labels"].tolist()
        file_paths_list = data["file_paths"].tolist()

        if len(labels_list) == 0:
            raise HTTPException(status_code=404, detail="No features found in the stored file.")

        correct_predictions = 0
        results = []

        for _ in range(num_tests):
            test_idx = random.randint(0, len(file_paths_list) - 1)
            img_path = file_paths_list[test_idx]
            true_label = labels_list[test_idx]

            # Load and preprocess image
            img = Image.open(img_path).convert("RGB")

            # Apply Random Crop
            if crop_ratio > 0:
                w, h = img.size
                crop_w, crop_h = int(w * crop_ratio), int(h * crop_ratio)
                left, top = random.randint(0, crop_w), random.randint(0, crop_h)
                right, bottom = w - random.randint(0, crop_w), h - random.randint(0, crop_h)
                img = img.crop((left, top, right, bottom))

            # Apply Random Rotation
            if rotation_range > 0:
                angle = random.uniform(-rotation_range, rotation_range)
                img = img.rotate(angle)

            # Resize and extract features
            img = img.resize((300, 300))
            img_array = np.expand_dims(np.array(img), axis=0)
            img_array = preprocess_input(img_array)

            input_feature = base_model.predict(img_array).flatten()
            input_feature /= np.linalg.norm(input_feature)

            # Faiss Search
            _, best_match_idx = faiss_index.search(np.array([input_feature]), 1)
            best_match_idx = best_match_idx[0][0]
            predicted_label = labels_list[best_match_idx]

            is_correct = (true_label == predicted_label)
            correct_predictions += is_correct

            results.append({
                "true_label": true_label,
                "predicted_label": predicted_label,
                "is_correct": is_correct
            })

        accuracy = (correct_predictions / num_tests) * 100

        return {
            "total_tests": num_tests,
            "correct_predictions": correct_predictions,
            "accuracy": f"{accuracy:.2f}%",
            "results": results,
        }
    except Exception as e:
        return {"detail": str(e)}
    

@app.post("/testusingdb/")
async def test_model_database(
    num_tests: int = Form(20),
    crop_ratio: float = Form(0.2),
    rotation_range: int = Form(45)
):
    global faiss_index, labels, file_paths
    try:
        if faiss_index is None or len(labels) == 0:
            raise HTTPException(status_code=400, detail="Feature database is empty. Load features first.")

        # Retrieve all building features
        buildings = building_collection.find({"features": {"$exists": True, "$not": {"$size": 0}}})

        features = []
        labels_list = []
        file_paths_list = []

        for building in buildings:
            for feature_entry in building["features"]:
                features.append(feature_entry["feature_vector"])
                labels_list.append(building["buildingName"])
                file_paths_list.append(feature_entry["image_url"])

        if len(features) == 0:
            raise HTTPException(status_code=404, detail="No features found in the database.")

        features = np.array(features)
        labels_list = np.array(labels_list)
        file_paths_list = np.array(file_paths_list)

        results = []

        for _ in range(num_tests):
            test_idx = random.randint(0, len(file_paths_list) - 1)
            test_image_url = file_paths_list[test_idx]
            true_label = labels_list[test_idx]

            # Download test image
            response = requests.get(test_image_url)
            img = Image.open(BytesIO(response.content))

            # Apply Augmentation (Cropping + Rotation)
            width, height = img.size
            left = int(width * random.uniform(0, crop_ratio))
            top = int(height * random.uniform(0, crop_ratio))
            right = int(width * (1 - random.uniform(0, crop_ratio)))
            bottom = int(height * (1 - random.uniform(0, crop_ratio)))
            img = img.crop((left, top, right, bottom))

            rotation_angle = random.uniform(-rotation_range, rotation_range)
            img = img.rotate(rotation_angle, expand=True)
            img = img.resize((300, 300))  # Resize to model input

            img_array = np.expand_dims(img_to_array(img), axis=0)
            img_array = preprocess_input(img_array)

            # Extract Features
            input_feature = base_model.predict(img_array).flatten()
            input_feature /= np.linalg.norm(input_feature)

            # Faiss Search
            _, best_match_idx = faiss_index.search(np.array([input_feature]), 1)
            best_match_idx = best_match_idx[0][0]
            predicted_label = labels_list[best_match_idx]
            predicted_file_path = file_paths_list[best_match_idx]

            # Convert Augmented Image to Base64
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            augmented_image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

            # Convert Predicted Image to Base64
            response = requests.get(predicted_file_path)
            predicted_img = Image.open(BytesIO(response.content))
            buffered = BytesIO()
            predicted_img.save(buffered, format="JPEG")
            predicted_image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

            # Append Result
            results.append({
                "true_label": true_label,
                "predicted_label": predicted_label,
                "similarity": np.linalg.norm(features[test_idx] - input_feature),  # L2 distance
                "is_correct": true_label == predicted_label,
                "augmented_image": augmented_image_base64,
                "predicted_image": predicted_image_base64,
            })

        # Calculate Accuracy
        correct_predictions = sum(1 for result in results if result["is_correct"])
        accuracy = (correct_predictions / num_tests) * 100

        return {
            "total_tests": num_tests,
            "correct_predictions": correct_predictions,
            "accuracy": f"{accuracy:.2f}%",
            "results": results,
            "message": "Test completed with intensive augmentation."
        }

    except Exception as e:
        return {"detail": str(e)}