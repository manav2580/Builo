import { Client, Databases, Query } from "appwrite";

// Initialize Appwrite client
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1") // Your Appwrite API Endpoint
  .setProject("679114e0000f40a268c9"); // Your Project ID

const databases = new Databases(client);

const DATABASE_ID = "679c6b8200104766575b";
const BUILDINGS_COLLECTION_ID = "67b5a977000e47803c1d";
const DETAILS_COLLECTION_ID = "67b5fc74001b3bdd6ce0";

// Function to generate random values for details
function generateRandomDetails() {
  const facilitiesOptions = ["Laundry", "Parking", "Wifi", "Gym", "Swimming"];
  const typeOptions = ["House", "Townhouse", "Condo", "Duplex", "Studio", "Villa", "Other", "Apartment"];
  return {
    area: Math.floor(Math.random() * 500) + 50,
    bedrooms: Math.floor(Math.random() * 5) + 1,
    bathrooms: Math.floor(Math.random() * 3) + 1,
    rating: parseFloat((Math.random() * 5).toFixed(1)),
    facilities: facilitiesOptions.sort(() => 0.5 - Math.random()).slice(0, 3),
    type: typeOptions[Math.floor(Math.random() * typeOptions.length)],
    yearBuilt: Math.floor(Math.random() * (2024 - 1999 + 1)) + 1990,
  };
}

// Seed function with pagination
async function seedDetails() {
  try {
    let lastDocumentId = null;
    let hasMore = true;

    while (hasMore) {
      const queries = [Query.limit(100)];
      if (lastDocumentId) queries.push(Query.cursorAfter(lastDocumentId));

      // Fetch a batch of buildings
      const buildings = await databases.listDocuments(DATABASE_ID, BUILDINGS_COLLECTION_ID, queries);

      if (buildings.documents.length === 0) {
        hasMore = false;
        break;
      }

      for (const building of buildings.documents) {
        if (building.detail) {
          console.log(`Skipping building ${building.$id}, details already exist.`);
          continue;
        }

        const detailsData = generateRandomDetails();

        const detailsDoc = await databases.createDocument(
          DATABASE_ID,
          DETAILS_COLLECTION_ID,
          "unique()",
          detailsData
        );

        await databases.updateDocument(DATABASE_ID, BUILDINGS_COLLECTION_ID, building.$id, {
          detail: detailsDoc.$id,
        });

        console.log(`✅ Added details for building ${building.$id}`);
      }

      // Update cursor for pagination
      lastDocumentId = buildings.documents[buildings.documents.length - 1].$id;
    }
  } catch (error) {
    console.error("❌ Error seeding details:", error);
  }
}

// Run the seed function
seedDetails();
