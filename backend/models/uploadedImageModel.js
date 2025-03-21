const mongoose = require('mongoose');

const uploadedImageSchema = new mongoose.Schema({
  imageName: { type: String, unique: true, required: true },
});

module.exports = mongoose.model('UploadedImage', uploadedImageSchema);
