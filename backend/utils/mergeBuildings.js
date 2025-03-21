const mongoose = require("mongoose");
const connectDB = require("./connectDB");
const Building = require("../models/buildingModel");

// Extracts the first 5 words from a building name
function getBuildingPrefix(name) {
  return name.split(" ").slice(0, 5).join(" ").toLowerCase();
}

async function mergeBuildings() {
  try {
    await connectDB(); // Ensure DB is connected

    // Fetch all buildings
    const buildings = await Building.find();
    console.log(`📊 Found ${buildings.length} buildings`);

    // Group buildings by their prefix name
    const groupedBuildings = {};
    buildings.forEach((building) => {
      const prefix = getBuildingPrefix(building.buildingName);
      if (!groupedBuildings[prefix]) {
        groupedBuildings[prefix] = [];
      }
      groupedBuildings[prefix].push(building);
    });

    let mergedCount = 0;

    // Process each group
    for (const prefix in groupedBuildings) {
      const group = groupedBuildings[prefix];

      if (group.length > 1) {
        console.log(`🔄 Merging ${group.length} buildings for prefix: "${prefix}"`);

        // Choose the first as the base
        const mergedBuilding = group[0];

        // Merge images and features
        for (let i = 1; i < group.length; i++) {
          mergedBuilding.exteriorImage.push(...group[i].exteriorImage);
          mergedBuilding.allImages.push(...group[i].allImages);
          mergedBuilding.features.push(...group[i].features);
        }

        // Remove duplicates from the merged arrays
        mergedBuilding.exteriorImage = Array.from(new Set(mergedBuilding.exteriorImage.map(img => img.url)))
          .map(url => mergedBuilding.exteriorImage.find(img => img.url === url));

        mergedBuilding.allImages = Array.from(new Set(mergedBuilding.allImages.map(img => img.url)))
          .map(url => mergedBuilding.allImages.find(img => img.url === url));

        mergedBuilding.features = Array.from(new Set(mergedBuilding.features.map(f => JSON.stringify(f))))
          .map(str => JSON.parse(str));

        // Save the merged building
        await mergedBuilding.save();

        // Delete old duplicates except the first one
        const idsToDelete = group.slice(1).map((b) => b._id);
        await Building.deleteMany({ _id: { $in: idsToDelete } });

        mergedCount++;
      }
    }

    console.log(`✅ Merged ${mergedCount} buildings`);
    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error merging buildings:", error);
  }
}

// Run the function
mergeBuildings();
