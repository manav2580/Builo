from fastapi import FastAPI, File, Query, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from tensorflow.keras.applications import ResNet50
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.resnet50 import preprocess_input
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict
import numpy as np
import os
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import random
from PIL import Image
from io import BytesIO
from fastapi.responses import FileResponse
import csv
from pymongo import MongoClient
import base64
from io import BytesIO
from PIL import Image
import requests

app = FastAPI()

# Initialize model (shared across endpoints for efficiency)
base_model = ResNet50(weights='imagenet', include_top=False, pooling='avg', input_shape=(224, 224, 3))
MONGO_URI = "mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client["test"]
building_collection = db["buildings"]

# Global variables for features and labels
features = None
labels = None
file_paths = None

# Endpoint: Extract Features from Dataset
@app.post("/extract_features/")
async def extract_features(dataset_folder: str = Form(...), output_file: str = Form("features.npz")):
    try:
        if not os.path.exists(dataset_folder):
            raise HTTPException(status_code=400, detail=f"Dataset folder '{dataset_folder}' not found.")

        # Dictionary to count number of images per building
        building_counts = defaultdict(int)

        # List all image files
        image_files = [f for f in os.listdir(dataset_folder) if os.path.isfile(os.path.join(dataset_folder, f))]

        extracted_features = []
        extracted_labels = []
        extracted_file_paths = []
        weights = []  # List to store weights for each image

        # Process each image and assign weights
        for img_name in image_files:
            img_path = os.path.join(dataset_folder, img_name)
            building_name = " ".join(img_name.split()[:4])    # Assume first word is building name for demonstration

            img = image.load_img(img_path, target_size=(224, 224))
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = preprocess_input(img_array)

            feature = base_model.predict(img_array)
            extracted_features.append(feature.flatten())
            extracted_labels.append(building_name)
            extracted_file_paths.append(img_path)

            # Count number of images per building
            building_counts[building_name] += 1

        # Calculate weights: buildings with fewer images should have higher weights
        total_images = len(extracted_file_paths)
        weights = [1.0 / building_counts[label] for label in extracted_labels]

        # Save features to file with weights
        np.savez(output_file, features=np.array(extracted_features), labels=np.array(extracted_labels), file_paths=np.array(extracted_file_paths), weights=np.array(weights))
        return {"message": f"Features extracted and saved to {output_file}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# Endpoint: Load Features
@app.post("/load_features/")
async def load_features(file_path: str = Query(..., description="Path to the .npz file")):
    try:
        # Loading features from file
        data = np.load(file_path)
        features = data['features']
        labels = data['labels']
        file_paths = data['file_paths']  # Now we load the file_paths

        # Check if features are empty or None
        if features is None or len(features) == 0:
            raise ValueError("Features are empty in the .npz file.")
        
        # Return the features, labels, and file paths in the response
        return {
            "features": features.tolist(),  # Convert numpy array to list for JSON compatibility
            "labels": labels.tolist(),      # Convert numpy array to list for JSON compatibility
            "file_paths": file_paths.tolist()  # Convert numpy array to list for JSON compatibility
        }
    
    except Exception as e:
        print(f"Error loading features from {file_path}: {e}")
        return {"error": f"Error loading features from {file_path}: {e}"}


# Endpoint: Classify Input Image
@app.post("/classify/")
async def classify(
    input_image: UploadFile = File(...), 
    latitude: float = 0.0, 
    longitude: float = 0.0
):
    try:
        # Calculate the latitude and longitude range (±0.1)
        latitude_min = latitude - 3
        latitude_max = latitude + 3
        longitude_min = longitude - 4
        longitude_max = longitude + 4

        # Fetch buildings within the specified latitude and longitude range
        buildings = building_collection.find(
            {
                "latitude": {"$gte": latitude_min, "$lte": latitude_max},
                "longitude": {"$gte": longitude_min, "$lte": longitude_max},
            }
        )

        features = []
        labels = []
        file_paths = []

        for building in buildings:
            if "features" in building:
                for feature_entry in building["features"]:
                    features.append(feature_entry["feature_vector"])
                    labels.append(building["buildingName"])  # Use building name as the label
                    file_paths.append(feature_entry["image_url"])

        # Ensure features are available
        if len(features) == 0:
            return JSONResponse(
                {"detail": "No buildings with features found in the specified range."}, status_code=404
            )

        features = np.array(features)

        # Read and preprocess the input image
        image_data = await input_image.read()
        img = Image.open(BytesIO(image_data))

        # Convert the image to RGB if it's not already (to avoid issues with channels)
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Resize the image to the accepted input shape (224x224)
        img = img.resize((224, 224))

        # Normalize and prepare the image for the model
        img_array = np.array(img)
        img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
        img_array = preprocess_input(img_array)  # Normalize pixel values

        # Extract features from the input image
        input_feature = base_model.predict(img_array).flatten()

        # Perform similarity calculation
        similarities = cosine_similarity([input_feature], features)[0]
        best_match_idx = np.argmax(similarities)

        return {
            "predicted_label": labels[best_match_idx],
            "similarity": similarities[best_match_idx],
            "file_path": file_paths[best_match_idx],  # Return the corresponding file path
        }
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)

@app.post("/test/")
async def test_model(
    num_tests: int = Form(20),
    crop_ratio: float = Form(0.2),  # Maximum crop ratio (20% default)
    rotation_range: int = Form(45)  # Rotation range (default ±45 degrees)
):
    try:
        # Retrieve all building features from the database
        buildings = building_collection.find({"features": {"$exists": True, "$not": {"$size": 0}}})

        features = []
        labels = []
        file_paths = []

        # Extract features, labels, and file paths from the database
        for building in buildings:
            for feature_entry in building["features"]:
                features.append(feature_entry["feature_vector"])
                labels.append(building["buildingName"])  # Use building name as the label
                file_paths.append(feature_entry["image_url"])

        if len(features) == 0:
            raise HTTPException(status_code=404, detail="No features found in the database.")

        features = np.array(features)
        labels = np.array(labels)
        file_paths = np.array(file_paths)

        # Randomly select test images from the database (simulated for testing purposes)
        results = []

        for _ in range(num_tests):
            # Randomly pick a feature and its associated image
            test_idx = random.randint(0, len(file_paths) - 1)
            test_image_url = file_paths[test_idx]
            true_label = labels[test_idx]

            # Download the test image
            response = requests.get(test_image_url)
            img = Image.open(BytesIO(response.content))

            # Apply intensive augmentation
            width, height = img.size
            left = int(width * random.uniform(0, crop_ratio))
            top = int(height * random.uniform(0, crop_ratio))
            right = int(width * (1 - random.uniform(0, crop_ratio)))
            bottom = int(height * (1 - random.uniform(0, crop_ratio)))
            img = img.crop((left, top, right, bottom))

            rotation_angle = random.uniform(-rotation_range, rotation_range)
            img = img.rotate(rotation_angle, expand=True)
            img = img.resize((224, 224))  # Resize to model input

            img_array = np.expand_dims(np.array(img), axis=0)
            img_array = preprocess_input(img_array)

            # Extract features and compute similarity
            input_feature = base_model.predict(img_array).flatten()
            similarities = cosine_similarity([input_feature], features)[0]

            best_match_idx = np.argmax(similarities)
            predicted_label = labels[best_match_idx]
            predicted_file_path = file_paths[best_match_idx]

            # Convert augmented image to base64
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            augmented_image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

            # Load and encode the predicted image
            response = requests.get(predicted_file_path)
            predicted_img = Image.open(BytesIO(response.content))
            buffered = BytesIO()
            predicted_img.save(buffered, format="JPEG")
            predicted_image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

            # Append results
            results.append({
                "true_label": true_label,
                "predicted_label": predicted_label,
                "similarity": similarities[best_match_idx],
                "is_correct": true_label == predicted_label,
                "augmented_image": augmented_image_base64,
                "predicted_image": predicted_image_base64,
            })

        # Calculate accuracy
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


@app.post("/generate_location_csv/")
async def generate_location_csv(
    dataset_folder: str = Form(...),  # Folder containing the images
    output_csv: str = Form("image_locations.csv")  # Name of the output CSV file
):
    try:
        if not os.path.exists(dataset_folder):
            raise HTTPException(status_code=400, detail=f"Dataset folder '{dataset_folder}' not found.")

        # List all image files in the folder
        image_files = [f for f in os.listdir(dataset_folder) if os.path.isfile(os.path.join(dataset_folder, f))]
        if not image_files:
            raise HTTPException(status_code=400, detail="No image files found in the dataset folder.")

        # Dictionary to store coordinates for each prefix
        prefix_coordinates = {}

        # List to store CSV rows
        csv_data = []

        for img_name in image_files:
            # Extract the prefix (first 4 words)
            prefix = " ".join(img_name.split()[:4])

            # Assign random coordinates if not already assigned
            if prefix not in prefix_coordinates:
                latitude = round(random.uniform(85, 88), 6)
                longitude = round(random.uniform(65, 68), 6)
                prefix_coordinates[prefix] = (latitude, longitude)

            # Retrieve coordinates for the current image
            latitude, longitude = prefix_coordinates[prefix]

            # Add row to CSV data
            csv_data.append([img_name, latitude, longitude])

        # Write to CSV in the same folder as the dataset
        csv_path = os.path.join(os.path.dirname(os.path.dirname(dataset_folder)), output_csv)
        with open(csv_path, mode="w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(["Image Name", "Latitude", "Longitude"])  # Header
            writer.writerows(csv_data)

        return JSONResponse(
            content={
                "message": f"CSV file '{output_csv}' has been saved in the dataset folder.",
                "file_path": {csv_path},
            },
            status_code=200
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))