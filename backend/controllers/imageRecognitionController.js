const axios = require('axios');

exports.classifyBuildingImage = async (req, res, next) => {
    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);

        const response = await axios.post('http://127.0.0.1:8000/classify/', formData, {
            headers: formData.getHeaders(),
        });

        res.status(200).json({
            success: true,
            data: response.data,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Classification failed', error: error.message });
    }
};
