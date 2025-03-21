import os
import random
import io
import requests
import numpy as np
import faiss
from PIL import Image
from fastapi import FastAPI, Form, HTTPException
from tensorflow.keras.applications.efficientnet import preprocess_input
from tensorflow.keras.applications import EfficientNetB3
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

app = FastAPI()

# Initialize Appwrite client
client = Client()
client.set_endpoint("https://cloud.appwrite.io/v1")
client.set_project("679114e0000f40a268c9")

database_id = "679c6b8200104766575b"
collection_id = "67b5a977000e47803c1d"
database = Databases(client)

# Load the EfficientNetB3 model
base_model = EfficientNetB3(weights="imagenet", include_top=False, pooling="avg", input_shape=(300, 300, 3))

@app.post("/test/")
async def test_model(num_tests: int = Form(20), crop_ratio: float = Form(0.2), rotation_range: int = Form(45)):
    global faiss_index, labels, file_paths

    try:
        # Fetch all buildings from Appwrite
        print("Fetching buildings from Appwrite...")
        all_buildings = []
        limit = 100  
        cursor = None  

        while True:
            queries = [Query.limit(limit)]
            if cursor:
                queries.append(Query.cursor_after(cursor))

            response = database.list_documents(database_id, collection_id, queries=queries)
            documents = response.get("documents", [])
            if not documents:
                break

            all_buildings.extend(documents)
            cursor = documents[-1]["$id"]  

        if not all_buildings:
            raise HTTPException(status_code=400, detail="Feature database is empty. Load features first.")

        all_features = []
        labels = []
        file_paths = []

        for building in all_buildings:
            feature_vectors = building.get("features_feature_vector", [])
            image_urls = building.get("features_image_url", [])
            building_name = building.get("buildingName", "Unknown")

            for feature_vector, image_url in zip(feature_vectors, image_urls):
                vector = np.array([float(x) for x in feature_vector.split(",")])
                vector = vector / np.linalg.norm(vector)  # Normalize
                all_features.append(vector)
                labels.append(building_name)
                file_paths.append(image_url)

        if not all_features:
            raise HTTPException(status_code=404, detail="No valid feature vectors found in the database.")

        # Convert to FAISS index format
        d = len(all_features[0])
        faiss_index = faiss.IndexFlatL2(d)
        faiss_index.add(np.array(all_features))

        correct_predictions = 0
        results = []

        for i in range(num_tests):
            test_idx = random.randint(0, len(file_paths) - 1)
            img_url = file_paths[test_idx]
            true_label = labels[test_idx]

            response = requests.get(img_url)
            img = Image.open(io.BytesIO(response.content)).convert("RGB")

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

            # FAISS Search
            _, best_match_idx = faiss_index.search(np.array([input_feature]), 1)
            best_match_idx = best_match_idx[0][0]
            predicted_label = labels[best_match_idx]
            predicted_img_url = file_paths[best_match_idx]

            is_correct = (true_label == predicted_label)
            correct_predictions += is_correct

            # Save test and predicted images
            folder_path = f"test_results/test_{i}"
            os.makedirs(folder_path, exist_ok=True)

            img.save(os.path.join(folder_path, "test_image.jpg"))

            response_predicted = requests.get(predicted_img_url)
            predicted_img = Image.open(io.BytesIO(response_predicted.content)).convert("RGB")
            predicted_img.save(os.path.join(folder_path, "predicted_image.jpg"))

            results.append({
                "true_label": true_label,
                "predicted_label": predicted_label,
                "is_correct": is_correct,
                "test_image_path": f"{folder_path}/test_image.jpg",
                "predicted_image_path": f"{folder_path}/predicted_image.jpg"
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
