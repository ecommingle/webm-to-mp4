const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const request = require('request');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));

// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Handle file upload and conversion
app.post('/convert', upload.single('webmfile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const convertTo = 'mp4';

    // Get API endpoint
    request({
        url: "https://www.webm.to/apis/",
        method: 'get'
    }, function (err, response, body) {
        if (err) return res.status(500).json({ error: err });

        const api_url = JSON.parse(body).api;

        // Send file to convert API
        const formData = {
            lang: 'en',
            convert_to: convertTo,
            files: fs.createReadStream(filePath)
        };

        request({
            url: `${api_url}/v1/convert/`,
            method: 'post',
            formData: formData,
            headers: {
                "Authorization": "api_key", // Replace with your real API key
                "Content-Type": "multipart/form-data"
            }
        }, function (err, response, body) {
            if (err) return res.status(500).json({ error: err });

            const data = JSON.parse(body);
            getResults(data, api_url, res, filePath);
        });
    });
});

// Poll for conversion results
function getResults(data, api_url, res, filePath) {
    if (data.error) return res.status(500).json(data);

    request({
        url: `${api_url}/v1/results/`,
        method: 'post',
        formData: data
    }, function (err, r, body) {
        if (err) return res.status(500).json({ error: err });

        const response = JSON.parse(body);
        if (!response.finished) {
            setTimeout(() => getResults(data, api_url, res, filePath), 1000);
            return;
        }

        // Clean up uploaded file
        fs.unlink(filePath, () => {});

        // Return download URLs
        const downloadUrls = response.files.map(file =>
            file.url.startsWith('/') ? `${api_url}${file.url}` : file.url
        );

        res.json({ urls: downloadUrls });
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
