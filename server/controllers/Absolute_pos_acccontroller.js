// server/controllers.js

const fs = require('fs');
const XLSX = require('xlsx');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const { calculateDistance, computeMetrics } = require('./services');

// --- Upload and Process Controller (merged from uploadController) ---
async function processUpload(req, res) {
  try {
    const files = req.files;
    if (files.length !== 2) {
      return res.status(400).json({ error: 'Please upload two Excel files.' });
    }

    const file1Path = files[0].path;
    const file2Path = files[1].path;

    const file1 = XLSX.readFile(file1Path);
    const file2 = XLSX.readFile(file2Path);

    const sheet1 = file1.Sheets[file1.SheetNames[0]];
    const sheet2 = file2.Sheets[file2.SheetNames[0]];

    const data1 = XLSX.utils.sheet_to_json(sheet1, { defval: '', raw: false });
    const data2 = XLSX.utils.sheet_to_json(sheet2, { defval: '', raw: false });

    const distances = [];
    const dataToSave = [];

    for (let i = 0; i < Math.min(data1.length, data2.length); i++) {
      const lat1 = parseFloat(data1[i]['Latitude'] || data1[i]['lat']);
      const lon1 = parseFloat(data1[i]['Longitude'] || data1[i]['lon']);
      const lat2 = parseFloat(data2[i]['Latitude'] || data2[i]['lat']);
      const lon2 = parseFloat(data2[i]['Longitude'] || data2[i]['lon']);

      if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
        const distance = calculateDistance(lat1, lon1, lat2, lon2);
        distances.push(distance);
        dataToSave.push({ lat1, lon1, lat2, lon2, distance });
      }
    }

    // Remove uploaded files after processing
    fs.unlinkSync(file1Path);
    fs.unlinkSync(file2Path);

    if (distances.length === 0) {
      return res.status(400).json({ error: 'No valid data found in the uploaded files.' });
    }

    const { allMetrics, nonOutlierMetrics, updatedData } = computeMetrics(distances, dataToSave);
    const createdAt = new Date().toISOString();

    res.json({
      allMetrics,
      nonOutlierMetrics,
      points: updatedData,
      createdAt,
    });
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ error: 'Server error while processing files.' });
  }
}

async function saveData(req, res) {
  const {
    file1Name,
    file2Name,
    createdAt,
    allMetrics,
    nonOutlierMetrics,
    points,
  } = req.body;

  const client = req.dbClient;

  try {
    const insertEntryQuery = `
      INSERT INTO entries (
        file1_name,
        file2_name,
        created_at,
        mean_positional_uncertainty,
        standard_deviation,
        ce90,
        mean_positional_uncertainty_no_outliers,
        standard_deviation_no_outliers,
        ce90_no_outliers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const entryResult = await client.query(insertEntryQuery, [
      file1Name,
      file2Name,
      createdAt,
      allMetrics.mean,
      allMetrics.stdDev,
      allMetrics.ce90,
      nonOutlierMetrics.mean,
      nonOutlierMetrics.stdDev,
      nonOutlierMetrics.ce90,
    ]);
    const entryId = entryResult.rows[0].id;

    const insertPointQuery = `
      INSERT INTO points (entry_id, lat1, lon1, lat2, lon2, distance, is_outlier, index)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await client.query(insertPointQuery, [
        entryId,
        point.lat1,
        point.lon1,
        point.lat2,
        point.lon2,
        point.distance,
        point.isOutlier,
        i + 1,
      ]);
    }

    res.status(200).json({ message: 'Data saved successfully.' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data to the database.' });
  }
}

// --- Entries Controller (merged from entriesController) ---
async function getEntries(req, res) {
  const client = req.dbClient;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    const totalEntriesResult = await client.query('SELECT COUNT(*) FROM entries');
    const totalEntries = parseInt(totalEntriesResult.rows[0].count);

    const getEntriesQuery = `
      SELECT * FROM entries
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const entriesResult = await client.query(getEntriesQuery, [limit, offset]);
    const entries = entriesResult.rows;

    res.json({
      totalEntries,
      totalPages: Math.ceil(totalEntries / limit),
      currentPage: page,
      entries,
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries from the database.' });
  }
}

// --- Points Controller (merged from pointsController) ---
async function getPointsByEntryId(req, res) {
  const client = req.dbClient;
  const entryId = parseInt(req.params.entryId);

  try {
    const getPointsQuery = `
      SELECT * FROM points WHERE entry_id = $1 ORDER BY index
    `;
    const pointsResult = await client.query(getPointsQuery, [entryId]);
    const points = pointsResult.rows;

    res.json(points);
  } catch (error) {
    console.error('Error fetching points:', error);
    res.status(500).json({ error: 'Failed to fetch points from the database.' });
  }
}

// --- Download Controller (merged from downloadController) ---
async function downloadCSV(req, res) {
  const client = req.dbClient;
  try {
    const query = `
      SELECT p.*, e.file1_name, e.file2_name
      FROM points p
      INNER JOIN entries e ON p.entry_id = e.id
    `;
    const result = await client.query(query);

    const csvWriter = createObjectCsvWriter({
      path: 'accuracy_data.csv',
      header: [
        { id: 'file1_name', title: 'Measured File' },
        { id: 'file2_name', title: 'Reference File' },
        { id: 'lat1', title: 'Measured Latitude' },
        { id: 'lon1', title: 'Measured Longitude' },
        { id: 'lat2', title: 'Reference Latitude' },
        { id: 'lon2', title: 'Reference Longitude' },
        { id: 'distance', title: 'Distance (m)' },
        { id: 'is_outlier', title: 'Is Outlier' },
        { id: 'index', title: 'Point Index' },
      ],
    });

    await csvWriter.writeRecords(result.rows);
    res.download(path.join(__dirname, 'accuracy_data.csv'), 'accuracy_data.csv', (err) => {
      if (err) console.error('Error while sending the file:', err);
      else fs.unlinkSync(path.join(__dirname, 'accuracy_data.csv'));
    });
  } catch (err) {
    console.error('Error while fetching or generating CSV:', err);
    res.status(500).send('Server error');
  }
}

module.exports = {
  processUpload,
  saveData,
  getEntries,
  getPointsByEntryId,
  downloadCSV,
};
