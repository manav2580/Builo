from pymongo import MongoClient

# MongoDB Configuration
MONGO_URI = "mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client['test']
building_collection = db['buildings']

def clean_invalid_features():
    """Remove entries with empty 'vector' arrays and an '_id' inside the 'features' array"""
    buildings = building_collection.find({"features.vector": []})

    for building in buildings:
        building_id = building["_id"]
        
        # Remove only the invalid feature entries
        building_collection.update_one(
            {"_id": building_id},
            {"$pull": {"features": {"vector": [], "_id": {"$exists": True}}}}
        )
        
        print(f"Cleaned features for building ID: {building_id}")

if __name__ == "__main__":
    clean_invalid_features()
    print("✅ Cleaning completed!")
