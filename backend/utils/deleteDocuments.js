import https from "https";
import axios from "axios";
import { Client, Databases, ID } from "appwrite";
import { Query } from "appwrite";
// Initialize Appwrite SDK
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("679114e0000f40a268c9");

const databases = new Databases(client);

async function deleteEmptyDocuments() {
    try {
      let batchSize = 100; // Increase batch size for efficiency
      let lastDocumentId = null;
      let totalDeleted = 0;
  
      while (true) {
        let queries = [Query.limit(batchSize)];
        if (lastDocumentId) {
          queries.push(Query.cursorAfter(lastDocumentId)); // Fetch next batch
        }
  
        let response = await databases.listDocuments(
          "679c6b8200104766575b",
          "67b5a977000e47803c1d",
          queries
        );
  
        if (response.documents.length === 0) break; // No more documents
  
        console.log(`🔍 Fetched ${response.documents.length} documents`);
  
        let emptyDocs = response.documents.filter((doc) => {
          return !doc.allImages_url || (Array.isArray(doc.allImages_url) && doc.allImages_url.length === 0);
        });
  
        console.log(`🗑️ Found ${emptyDocs.length} empty documents to delete`);
  
        for (const doc of emptyDocs) {
          await databases.deleteDocument("679c6b8200104766575b", "67b5a977000e47803c1d", doc.$id);
          console.log(`✅ Deleted document ${doc.$id}`);
          totalDeleted++;
        }
  
        lastDocumentId = response.documents[response.documents.length - 1].$id; // Set cursor for next batch
      }
  
      console.log(`🎉 Finished! Total documents deleted: ${totalDeleted}`);
    } catch (error) {
      console.error("❌ Error deleting documents:", error.message);
    }
  }
  
  deleteEmptyDocuments();
  
  