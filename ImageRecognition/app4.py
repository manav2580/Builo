from collections import defaultdict
import io
from tensorflow.keras.preprocessing import image
import numpy as np
import faiss
import requests
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
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
all_buildings = []
# Load features from Appwrite
def load_features():
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

    all_features, labels, file_paths = [], [], []
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

    d = len(all_features[0])
    faiss_index = faiss.IndexFlatL2(d)
    faiss_index.add(np.array(all_features))

    return faiss_index, labels, file_paths

faiss_index, labels, file_paths = load_features()

@app.post("/predict/")
async def predict_building(file: UploadFile = File(...)):
    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
        image = image.resize((300, 300))
        img_array = np.expand_dims(np.array(image), axis=0)
        img_array = preprocess_input(img_array)

        input_feature = base_model.predict(img_array).flatten()
        input_feature /= np.linalg.norm(input_feature)

        # FAISS Search
        _, best_match_idx = faiss_index.search(np.array([input_feature]), 1)
        best_match_idx = best_match_idx[0][0]
        predicted_label = labels[best_match_idx]
        predicted_img_url = file_paths[best_match_idx]

        # Find the corresponding $id from all_buildings
        predicted_id = next(
            (building["$id"] for building in all_buildings if building["buildingName"] == predicted_label),
            None
        )

        return {
            "predicted_building": predicted_label,
            "predicted_id": predicted_id,
            "image_url": predicted_img_url,
        }

    except Exception as e:
        return {"detail": str(e)}

@app.post("/extract_features_from_urls/")
async def extract_features_from_urls(urls: list[str] = Form(...)):
    try:
        if not urls:
            raise HTTPException(status_code=400, detail="No URLs provided.")

        extracted_features = []
        extracted_labels = []
        extracted_file_paths = []

        building_counts = defaultdict(int)

        for url in urls:
            response = requests.get(url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image from {url}")

            img = Image.open(io.BytesIO(response.content)).convert("RGB")
            img = img.resize((300, 300))  # Resize image
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = preprocess_input(img_array)

            feature = base_model.predict(img_array).flatten()
            feature /= np.linalg.norm(feature)  # L2 Normalize features

            building_name = url.split("/")[-1].split(".")[0]  # Extract name from URL

            extracted_features.append(feature.tolist())  # Convert numpy array to list
            extracted_labels.append(building_name)
            extracted_file_paths.append(url)

            building_counts[building_name] += 1
        print(extracted_features,extracted_labels,extracted_file_paths)
        return {
            "features": extracted_features,
            "labels": extracted_labels,
            "file_paths": extracted_file_paths,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))