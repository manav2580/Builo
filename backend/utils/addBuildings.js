const mongoose = require('mongoose');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Building = require('../models/buildingModel'); // Adjust the path to your model
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dugkqpzgq',
  api_key: '367491339432393',
  api_secret: 'ONegEBqAeDQBQKY7tRRwTI1q_-E',
});

// Connect to MongoDB
mongoose.connect("mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Function to upload images to Cloudinary
const uploadToCloudinaryWithRetry = async (filePath, retries = 3, delay = 1000) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const result = await cloudinary.uploader.upload(filePath, { folder: 'building_images' });
      return { public_id: result.public_id, url: result.secure_url };
    } catch (error) {
      console.error(`Attempt ${attempt + 1}: Cloudinary Upload Error:`, error);
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
      } else {
        console.error(`Failed to upload ${filePath} after ${retries} attempts.`);
        return null; // Return null if all attempts fail
      }
    }
    attempt++;
  }
};


// Function to process CSV and insert into the database
const processCSVAndInsertData = async (csvFilePath, imagesFolderPath) => {
  const buildings = {}; // Stores buildings with images grouped by building name

  const promises = []; // Store all async operations here

  fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on('data', (row) => {
      const image_name = row['Image Name']; // Use the exact column name
      const latitude = row['Latitude'];
      const longitude = row['Longitude'];
      const buildingName = image_name.split('_').slice(0, 4).join(' '); // Get the common prefix for the building name

      // Add an async operation to the promises array
      promises.push(
        (async () => {
          if (!buildings[buildingName]) {
            // If not, create a new building entry
            buildings[buildingName] = {
              buildingName,
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              exteriorImage: [],
              allImages: [],
              address: `Random address for ${buildingName}`,
              country: 'Random Country',
              price: Math.floor(Math.random() * 500000) + 100000, // Random price
              description: `Description for ${buildingName}`,
            };
          }

          // Get the full image path
          const imagePath = path.join(imagesFolderPath, image_name);

          // Upload image to Cloudinary
          const uploadedImage = await uploadToCloudinaryWithRetry(imagePath);
          if (uploadedImage) {
            console.log(uploadedImage);
            // Add the uploaded image to both exteriorImage and allImages arrays
            buildings[buildingName].exteriorImage.push(uploadedImage);
            buildings[buildingName].allImages.push(uploadedImage);
          }
        })()
      );
    })
    .on('end', async () => {
      try {
        // Wait for all async operations to complete
        await Promise.all(promises);

        // Insert buildings into the database
        const buildingDocuments = Object.values(buildings);
        await Building.insertMany(buildingDocuments);
        console.log('Buildings inserted successfully!');
      } catch (error) {
        console.error('Error processing CSV:', error);
      } finally {
        mongoose.connection.close();
      }
    });
};

// Provide paths to the CSV and images folder
const csvFilePath = 'C:/Users/priti/Desktop/Builo/ImageRecognition/image_locations.csv'; // Path to your CSV file
const imagesFolderPath = 'C:/Users/priti/Desktop/Builo/ImageRecognition/ImagesBuildings/Outside Images Train'; // Path to your images folder
processCSVAndInsertData(csvFilePath, imagesFolderPath);
