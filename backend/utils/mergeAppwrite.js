const { Client, Databases, Query } = require("appwrite");

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1") // Your Appwrite API Endpoint
  .setProject("679114e0000f40a268c9");

const databases = new Databases(client);
const DATABASE_ID = "679c6b8200104766575b";
const COLLECTION_ID = "67b5a977000e47803c1d";

async function fetchAllDocuments() {
    let allDocuments = [];
    let offset = 0;
    const limit = 100; // Max limit per request
  
    try {
      while (true) {
        const response = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_ID,
          [Query.limit(limit), Query.offset(offset)]
        );
  
        allDocuments = [...allDocuments, ...response.documents];
  
        if (response.documents.length < limit) break; // Stop if last batch is smaller than limit
  
        offset += limit; // Move to next batch
      }
  
      console.log(`✅ Fetched ${allDocuments.length} documents.`);
      return allDocuments;
    } catch (error) {
      console.error("❌ Error fetching documents:", error);
      return [];
    }
  }
  
  async function mergeDocumentsByBuildingName() {
    try {
      const documents = await fetchAllDocuments();
      if (documents.length === 0) return;
  
      const groupedDocs = {};
  
      // Group documents by the first 3 words of `buildingName`
      documents.forEach((doc) => {
        const prefix = doc.buildingName.split(" ").slice(0, 3).join(" ").toLowerCase();
        if (!groupedDocs[prefix]) {
          groupedDocs[prefix] = [];
        }
        groupedDocs[prefix].push(doc);
      });
  
      // Merge grouped documents
      for (const prefix in groupedDocs) {
        const docs = groupedDocs[prefix];
  
        if (docs.length > 1) {
          console.log(`Merging ${docs.length} documents for prefix: "${prefix}"`);
  
          // Merge data
          const mergedData = {
            buildingName: docs[0].buildingName,
            address: docs[0].address,
            country: docs[0].country,
            price: docs[0].price,
            description: docs.map((d) => d.description).join("\n"),
            latitude: docs[0].latitude,
            longitude: docs[0].longitude,
            exteriorImage_url: [...new Set(docs.flatMap((d) => d.exteriorImage_url))],
            allImages_url: [...new Set(docs.flatMap((d) => d.allImages_url))],
            features_image_url: [...new Set(docs.flatMap((d) => d.features_image_url))],
            features_feature_vector: [...new Set(docs.flatMap((d) => d.features_feature_vector))],
          };
  
          // Create a new merged document
          const mergedDoc = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            "unique()",
            mergedData
          );
          console.log("✅ Created merged document:", mergedDoc.$id);
  
          // Delete old documents
          for (const doc of docs) {
            await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, doc.$id);
            console.log(`🗑️ Deleted old document: ${doc.$id}`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error merging documents:", error);
    }
  }
  
  // Run the function
  mergeDocumentsByBuildingName();
