const { Client, Databases } = require("appwrite");
const mongoose = require("mongoose");
const Building = require("../models/buildingModel"); // Import your MongoDB model
require("dotenv").config();

// Connect to MongoDB
mongoose.connect("mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Initialize Appwrite client
const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1") // Appwrite API Endpoint
    .setProject("679114e0000f40a268c9"); // Appwrite Project ID

const databases = new Databases(client);
const DATABASE_ID = "679c6b8200104766575b";
const COLLECTION_ID = "67b5a977000e47803c1d";

async function transferData() {
    try {
        // Fetch all documents from MongoDB
        console.log("🔍 Fetching data from MongoDB...");
        const buildings = await Building.find(); // Fetch all buildings
        console.log(`📄 Found ${buildings.length} documents.`);

        for (const building of buildings) {
            try {
                // Transfer document to Appwrite
                const response = await databases.createDocument(DATABASE_ID, COLLECTION_ID, "unique()", {
                    latitude: building.latitude,
                    longitude: building.longitude,
                    exteriorImage_url: building.exteriorImage.map(img => img.url),
                    exteriorImage_publicId: building.exteriorImage.map(img => img.public_id),
                    allImages_url: building.allImages.map(img => img.url),
                    allImages_publicId: building.allImages.map(img => img.public_id),
                    address: building.address,
                    country: building.country,
                    price: building.price,
                    buildingName:building.buildingName,
                    description: building.description,
                    features_image_url: building.features.map(feature => feature.image_url),
                    features_feature_vector: building.features.map(feature => feature.feature_vector.join(",")), // Convert array to string

                });
                console.log(`✅ Successfully transferred: ${response.$id}`);
            } catch (err) {
                console.error(`❌ Error transferring document ${building._id}:`, err.message);
            }
        }

        console.log("🎉 Data transfer completed!");
    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        mongoose.connection.close(); // Close MongoDB connection
    }
}

transferData();
