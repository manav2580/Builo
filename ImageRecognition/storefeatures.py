import numpy as np
import requests
from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input
from tensorflow.keras.preprocessing import image
from io import BytesIO
from PIL import Image
from pymongo import MongoClient
from bson import ObjectId

# MongoDB Configuration
MONGO_URI = "mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client['test']
building_collection = db['buildings']

# Initialize Feature Extractor
model = ResNet50(weights='imagenet', include_top=False, pooling='avg')

def extract_features_from_url(img_url):
    """Download the image from the URL and extract features."""
    try:
        response = requests.get(img_url, timeout=10)
        response.raise_for_status()  # Raise an exception for HTTP errors
        img = Image.open(BytesIO(response.content)).convert("RGB")
        img = img.resize((224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)
        features = model.predict(img_array)
        return features.flatten().tolist()
    except Exception as e:
        print(f"Error processing image from URL {img_url}: {e}")
        return None

def store_features_in_db(building_id, features, image_url):
    """Store extracted features in the MongoDB."""
    building_collection.update_one(
        {"_id": ObjectId(building_id)},
        {
            "$push": {
                "features": {
                    "image_url": image_url,
                    "feature_vector": features
                }
            }
        }
    )

def process_buildings_and_extract_features():
    """Process buildings and extract features for each exterior image."""
    buildings = building_collection.find()
    for building in buildings:
        building_id = building["_id"]
        building_name = building["buildingName"]
        exterior_images = building["exteriorImage"]

        print(f"Processing building: {building_name}")

        for img in exterior_images:
            image_url = img["url"]

            # Extract features from the Cloudinary URL
            features = extract_features_from_url(image_url)

            if features is not None:
                # Store features in the database
                store_features_in_db(building_id, features, image_url)
                print(f"Stored features for image: {image_url}")

if __name__ == "__main__":
    process_buildings_and_extract_features()
    print("Feature extraction and storage complete!")
