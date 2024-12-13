// server/routes.js
// Combine all the routes in one file

const express = require('express');
const multer = require('multer');
const {
  processUpload,
  saveData,
  getEntries,
  getPointsByEntryId,
  downloadCSV
} = require('./controllers');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload routes
router.post('/upload', upload.array('files', 2), processUpload);
router.post('/upload/save', saveData);

// Entries routes
router.get('/getEntries', getEntries);

// Points routes
router.get('/getPoints/:entryId', getPointsByEntryId);

// Download route
router.get('/download', downloadCSV);

module.exports = router;
