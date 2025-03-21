const mongoose = require('mongoose');
const Building = require('../models/buildingModel'); // Adjust path if necessary
require('dotenv').config();

// Connect to MongoDB
mongoose.connect("mongodb+srv://manavshah:manavshah@cluster0.0ni9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

const deleteEmptyFeatureBuildings = async () => {
  try {
    const result = await Building.deleteMany({ features: { $size: 0 } });
    console.log(`Deleted ${result.deletedCount} documents with empty features array.`);
  } catch (error) {
    console.error('Error deleting documents:', error);
  } finally {
    mongoose.connection.close();
  }
};

deleteEmptyFeatureBuildings();
