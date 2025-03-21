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
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// File to log skipped images
const skippedImagesFile = 'skipped_images.txt';

// Function to upload images to Cloudinary
const uploadToCloudinaryWithRetry = async (filePath, retries = 3, delay = 1000) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const result = await cloudinary.uploader.upload(filePath, { folder: 'building_images' });
      return { public_id: result.public_id, url: result.secure_url };
    } catch (error) {
      console.error(`⚠️ Attempt ${attempt + 1}: Cloudinary Upload Error for ${filePath}:`, error.message);
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
      } else {
        console.error(`❌ Failed to upload ${filePath} after ${retries} attempts.`);
        fs.appendFileSync(skippedImagesFile, `${filePath}\n`); // Save skipped image path
        return null; // Return null if all attempts fail
      }
    }
    attempt++;
  }
};

// Function to process CSV and insert data in batches
const processCSVAndInsertData = async (csvFilePath, imagesFolderPath, batchSize = 50) => {
  console.log('📂 Reading CSV File...');

  const buildings = {}; // Store building details grouped by building name
  const imageUploadQueue = []; // Stores async image upload tasks

  fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on('data', (row) => {
      const image_name = row['Image Name']; // Use the exact column name
      const latitude = row['Latitude'];
      const longitude = row['Longitude'];
      const buildingName = image_name.split('_').slice(0, 4).join(' '); // Get common prefix for building name

      if (!buildings[buildingName]) {
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

      const imagePath = path.join(imagesFolderPath, image_name);
      imageUploadQueue.push({ imagePath, buildingName });
    })
    .on('end', async () => {
      console.log(`✅ CSV file read successfully! ${imageUploadQueue.length} images found.`);
      console.log(`🚀 Starting batch processing with batch size ${batchSize}...`);

      let processedCount = 0;
      for (let i = 0; i < imageUploadQueue.length; i += batchSize) {
        const batch = imageUploadQueue.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${i / batchSize + 1} (${batch.length} images)...`);

        const uploadPromises = batch.map(async ({ imagePath, buildingName }) => {
          const uploadedImage = await uploadToCloudinaryWithRetry(imagePath);
          if (uploadedImage) {
            buildings[buildingName].exteriorImage.push(uploadedImage);
            buildings[buildingName].allImages.push(uploadedImage);
          }
        });

        await Promise.all(uploadPromises);
        processedCount += batch.length;
        console.log(`✅ ${processedCount}/${imageUploadQueue.length} images processed.`);
      }

      console.log('📊 Upload complete. Now inserting data into MongoDB...');

      try {
        const buildingDocuments = Object.values(buildings);
        await Building.insertMany(buildingDocuments);
        console.log(`✅ Successfully inserted ${buildingDocuments.length} buildings into MongoDB!`);
      } catch (error) {
        console.error('❌ MongoDB Insert Error:', error);
      } finally {
        mongoose.connection.close();
        console.log('🔌 MongoDB connection closed.');
        console.log(`📄 Skipped images are logged in '${skippedImagesFile}'`);
      }
    });
};

// Provide paths to the CSV and images folder
const csvFilePath = 'C:/Users/priti/Desktop/Builo/ImageRecognition/image_locations.csv';
const imagesFolderPath = 'C:/Users/priti/Desktop/Builo/ImageRecognition/TrainingImages/Exterior';
processCSVAndInsertData(csvFilePath, imagesFolderPath, 50);
