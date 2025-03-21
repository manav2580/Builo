import https from "https";
import axios from "axios";
import { Client, Databases, ID } from "appwrite";

// Initialize Appwrite SDK
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("679114e0000f40a268c9");

const databases = new Databases(client);

// Load classification model
async function classifyImage(imageUrl) {
  try {
    const response = await axios.post("http://localhost:8000/classify", { url: imageUrl });
    return response.data.predictions;
  } catch (error) {
    console.error("❌ Error in image classification:", error.message);
    return [];
  }
}

// Check if an image contains a building
async function isBuilding(imageUrl) {
    const predictions = await classifyImage(imageUrl);
    return predictions.some((pred) => pred.label.toLowerCase() === "house facade" && pred.score > 0.7);
  }
  

// Fetch nearby places
const fetchBuildings = () => {
    return new Promise((resolve, reject) => {
      const options = {
        method: "GET",
        hostname: "maps-data.p.rapidapi.com",
        path: "/nearby.php?query=buildings&lat=19.1261493&lng=72.8333755&limit=100&lang=en&offset=0&zoom=12",
        headers: {
          "x-rapidapi-key": "54cedd491emsh1ee8355d39c4aa1p11f4afjsnf6f9a22e1219",
          "x-rapidapi-host": "maps-data.p.rapidapi.com",
        },
      };
  
      const req = https.request(options, (res) => {
        let data = "";
  
        res.on("data", (chunk) => {
          data += chunk;
        });
  
        res.on("end", () => {
          console.log("Full API Response:", data); // Debugging line
  
          try {
            const response = JSON.parse(data);
  
            if (response && Array.isArray(response.data) && response.data.length > 0) {
              // Extract relevant data
              const buildings = response.data;
              resolve(buildings);
            } else {
              reject("❌ No valid buildings found in API response.");
            }
          } catch (error) {
            reject("Error parsing response: " + error);
          }
        });
      });
  
      req.on("error", (error) => reject("API Error: " + error));
      req.end();
    });
  };
  
  

// Fetch building photos
const fetchBuildingPhotos = (businessId) => {
  const options = {
    method: "GET",
    hostname: "maps-data.p.rapidapi.com",
    path: `/photos.php?business_id=${encodeURIComponent(businessId)}&lang=en&country=us`,
    headers: {
      "x-rapidapi-key": "54cedd491emsh1ee8355d39c4aa1p11f4afjsnf6f9a22e1219",
      "x-rapidapi-host": "maps-data.p.rapidapi.com",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
        //   console.log("Photos Data:",response);
          resolve(response.data.photos || []);
        } catch (error) {
          reject("❌ Error parsing photo response: " + error);
        }
      });
    });

    req.on("error", (error) => reject("❌ Photo API Error: " + error));
    req.end();
  });
};

// Store building data
const storeBuildingData = async (place) => {
  try {
    console.log("Place:",place);
    const response = await fetchBuildingPhotos(place.business_id);
    console.log("Photos:",response);
    const photos=response;
    if (photos.length === 0) {
      console.log(`❌ No photos found for ${place.name}`);
      return;
    }
    // console.log("Manav");
    // Filter valid building images
    const validPhotos = [];
    for (const photo of photos) {
      if (await isBuilding(photo)) {
        validPhotos.push(photo);
      }
    }

    if (validPhotos.length === 0) {
      console.log(`🚫 No valid building images for ${place.name}, skipping...`);
      return;
    }

    const buildingFormData = {
      latitude: place.latitude || 0,
      longitude: place.longitude || 0,
      buildingName: place.name || "Unknown Building",
      address: place.full_address || "No Address Available",
      country: "India",
      price: Math.floor(Math.random() * (500000 - 50000) + 50000),
      description:"No description available",
      exteriorImage_url: validPhotos,
      allImages_url: validPhotos,
      features_image_url: validPhotos,
      features_feature_vector: [],
    };

    const buildingResult = await databases.createDocument(
      "679c6b8200104766575b",
      "67b5a977000e47803c1d",
      ID.unique(),
      buildingFormData
    );

    console.log(`✅ Building Created: ${buildingFormData.buildingName}`);

    const detailsFormData = {
      buildingName: place.name || "Unknown Building",
      type: "House",
      area: Math.floor(Math.random() * (500 - 50) + 50),
      bedrooms: Math.floor(Math.random() * (5 - 1) + 1),
      bathrooms: Math.floor(Math.random() * (4 - 1) + 1),
      rating: place.rating || parseFloat((Math.random() * (5 - 3) + 3).toFixed(1)),
      facilities: ["Gym", "Parking", "Swimming", "Wifi"]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * (4 - 1) + 1)),
      yearBuilt: Math.floor(Math.random() * (2024 - 1990) + 1990),
    };

    await databases.createDocument(
      "679c6b8200104766575b",
      "67b5fc74001b3bdd6ce0",
      ID.unique(),
      detailsFormData
    );

    console.log(`✅ Details Created for: ${detailsFormData.buildingName}`);
  } catch (error) {
    console.error("❌ Error storing building data:", error);
  }
};

// Main function
const main = async () => {
  try {
    const buildings = await fetchBuildings();
    if (!Array.isArray(buildings) || buildings.length === 0) {
      console.log("❌ No valid buildings found.");
      return;
    }

    console.log(`✅ Processing ${buildings.length} buildings...`);
    for (const place of buildings) {
        console.log(place)
      }
    for (const place of buildings) {
      await storeBuildingData(place);
    }
  } catch (error) {
    console.error("❌ Error in main:", error);
  }
};

// Run script
main();
