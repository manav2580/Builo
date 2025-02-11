const Building = require('../models/buildingModel');
const catchAsyncErrors = require('../middleware/catchAsyncErrors');
const NodeGeocoder = require('node-geocoder');

const geocoder = NodeGeocoder({
    provider: 'openstreetmap', // You can also use 'google', 'mapquest', etc.
    httpAdapter: 'https',     // Use https for secure requests
    formatter: null           // By default, raw response
});

// Controller function to create a new building
exports.createBuilding = catchAsyncErrors(async (req, res, next) => {
    const {
        latitude,
        longitude,
        exteriorImage,
        allImages,
        buildingName,
        address,
        country,
        price,
        description
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude || !buildingName || !address || !country||!price||!description) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields',
        });
    }

    // Create the building document
    const building = await Building.create({
        latitude,
        longitude,
        exteriorImage: exteriorImage || [],
        allImages: allImages || [],
        buildingName,
        address,
        country,
        price,
        description
    });

    res.status(201).json({
        success: true,
        building,
    });
});

exports.filterByLocation = catchAsyncErrors(async (req, res, next) => {
    const { latitude, longitude } = req.body;

    // Validate that latitude and longitude are provided
    if (!latitude || !longitude) {
        return res.status(400).json({
            success: false,
            message: 'Latitude and Longitude are required to filter buildings.',
        });
    }

    // Parse latitude and longitude to ensure they are numbers
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid latitude or longitude format.',
        });
    }

    // Define the range for filtering
    const range = 0.1;

    // Query the database for buildings within the latitude and longitude range
    const buildings = await Building.find({
        latitude: { $gte: lat - range, $lte: lat + range },
        longitude: { $gte: lon - range, $lte: lon + range },
    });

    // Send the filtered buildings as the response
    res.status(200).json({
        success: true,
        count: buildings.length,
        data: buildings,
    });
});
exports.filterByName=catchAsyncErrors(async(req,res,next)=>{
    const {buildingName}=req.body;
    if(!buildingName)
        {
            return res.status(400).json({
                success:false,
                message:"Building name not provided"
            })
        } 
        const buildings = await Building.find({
            buildingName: { $regex: new RegExp(buildingName, "i") }, // Case-insensitive regex
        });
    
        // Send the filtered buildings as the response
        res.status(200).json({
            success: true,
            count: buildings.length,
            data: buildings,
        });
    

})
exports.getAllBuildings = catchAsyncErrors(async (req, res, next) => {
    try {
      const buildings = await Building.find();
      res.status(200).json({
        success: true,
        data: buildings,
      });
    } catch (error) {
      next(error); // Pass any errors to the error-handling middleware
    }
  });
  exports.groupByName = catchAsyncErrors(async (req, res, next) => {
    try {
      // Fetch all buildings from the database
      const buildings = await Building.find();
  
      // Group buildings by their name prefix
      const groupedBuildings = {};
  
      buildings.forEach((building) => {
        const prefix = building.buildingName.split(' ').slice(0, 4).join(' '); // Get the prefix
  
        if (!groupedBuildings[prefix]) {
          groupedBuildings[prefix] = {
            ...building.toObject(),
            exteriorImage: [],
            allImages: [],
          };
        }
  
        // Merge images
        groupedBuildings[prefix].exteriorImage = [
          ...groupedBuildings[prefix].exteriorImage,
          ...building.exteriorImage,
        ];
        groupedBuildings[prefix].allImages = [
          ...groupedBuildings[prefix].allImages,
          ...building.allImages,
        ];
      });
  
      // Convert the grouped buildings back to an array
      const consolidatedBuildings = Object.values(groupedBuildings);
  
      // Remove old entries from the database
      await Building.deleteMany({});
  
      // Insert consolidated buildings into the database
      await Building.insertMany(consolidatedBuildings);
  
      // Return the grouped data as a response
      res.status(200).json({
        success: true,
        data: consolidatedBuildings,
      });
    } catch (error) {
      next(error); // Pass the error to the error handler middleware
    }
  });