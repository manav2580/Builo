const { Client, Databases } = require("appwrite");
require("dotenv").config(); // Load .env variables

// Initialize Appwrite client
const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1") // Your Appwrite API Endpoint
    .setProject("679114e0000f40a268c9"); // Your Project ID
    // 
console.log("Appwrite Endpoint:", process.env.APPWRITE_ENDPOINT);

const databases = new Databases(client);
const DATABASE_ID = "679c6b8200104766575b";
const COLLECTION_ID = "67b5a977000e47803c1d";

async function testAppwrite() {
    try {
        // Step 1: Create a test document
        console.log("📝 Creating test document...");
        const testDoc = await databases.createDocument(DATABASE_ID, COLLECTION_ID, "unique()", {
            latitude: 12.345678,
            longitude: 98.765432,
            address: "123 Test Street",
            country: "Testland",
            buildingName:"AABC",
            price: 50000,
            description: "This is a test property."
        });
        console.log("✅ Document Created:", testDoc);

        // Step 2: Fetch the created document
        console.log("🔍 Fetching created document...");
        const fetchedDoc = await databases.getDocument(DATABASE_ID, COLLECTION_ID, testDoc.$id);
        console.log("✅ Document Fetched:", fetchedDoc);

        // Step 3: Delete the document to clean up
        console.log("🗑️ Deleting test document...");
        await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, testDoc.$id);
        console.log("✅ Document Deleted Successfully");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

testAppwrite();
