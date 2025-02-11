const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const buildingSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90,
    set: (v) => parseFloat(v.toFixed(6)), // Limits to 6 decimal places
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180,
    set: (v) => parseFloat(v.toFixed(6)), // Limits to 6 decimal places
  },
  exteriorImage: [{
    public_id: {
      type: String,
    },
    url: {
      type: String,
    }
  }],
  allImages: [{
    public_id: {
      type: String,
    },
    url: {
      type: String,
    }
  }],
  buildingName: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  description:{
    type:String,
    required:true
  },
  features: [{
    // Each image's feature vector
    imageId: { type: String }, // Identifier for the image
    vector: { type: [Number] }, // Feature vector for the image
  }],
});
buildingSchema.plugin(AutoIncrement, { inc_field: 'id' });

const Building = mongoose.model('Building', buildingSchema);

module.exports = Building;
