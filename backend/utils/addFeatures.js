import { Client, Databases, Query } from "appwrite";
import axios from "axios";

// Initialize Appwrite
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("679114e0000f40a268c9");
const databases = new Databases(client);

// Fetch all documents with pagination
async function fetchAllDocuments() {
  let allDocuments = [];
  let cursor = null;

  while (true) {
    const queries = [Query.isNull("detail"), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const response = await databases.listDocuments(
      "679c6b8200104766575b",
      "67b5a977000e47803c1d",
      queries
    );

    allDocuments = allDocuments.concat(response.documents);
    if (response.documents.length < 100) break; // Stop when fewer than 100 docs are returned

    cursor = response.documents[response.documents.length - 1].$id;
  }
  return allDocuments;
}

// Process documents
async function processDocuments() {
  try {
    console.log("🔍 Fetching all documents from Appwrite...");
    const documents = await fetchAllDocuments();
    console.log(`📄 Retrieved ${documents.length} documents to process`);

    for (const doc of documents) {
      console.log(`🔹 Processing document ID: ${doc.$id}`);

      if (doc.features_image_url?.length > 0) {
        console.log(`🖼️ Found ${doc.features_image_url.length} image URLs for document ${doc.$id}`);

        let allFeatureVectors = await Promise.all(
          doc.features_image_url.map(async (imageUrl) => {
            console.log(`🌐 Sending image to API: ${imageUrl}`);
            const featureVector = await classifyImage(imageUrl);
            return featureVector.length > 0 ? featureVector.join(",") : null;
          })
        );

        allFeatureVectors = allFeatureVectors.filter(Boolean);

        if (allFeatureVectors.length > 0) {
          console.log(`📝 Updating document ${doc.$id} with ${allFeatureVectors.length} feature vectors...`);
          await databases.updateDocument("679c6b8200104766575b", "67b5a977000e47803c1d", doc.$id, {
            features_feature_vector: allFeatureVectors,
          });
          console.log(`✅ Successfully updated document ${doc.$id}`);
        } else {
          console.warn(`⚠️ No valid feature vectors for document ${doc.$id}, skipping update.`);
        }
      } else {
        console.warn(`⚠️ No image URLs found for document ${doc.$id}`);
      }
    }
  } catch (error) {
    console.error("❌ Error processing documents:", error);
  }
}

// Call External API
async function classifyImage(imageUrl) {
  try {
    const formData = new FormData();
    formData.append("urls", imageUrl);

    const response = await axios.post("http://localhost:8000/extract_features_from_urls/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data.features || [];
  } catch (error) {
    console.error(`❌ Error in image classification for ${imageUrl}:`, error.response?.data || error.message);
    return [];
  }
}

// Run the function
processDocuments();
