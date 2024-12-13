// server/services.js

const math = require('mathjs');

// Services merged from distanceService, metricsService

// Function to calculate distance between two lat/long points using the Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.asin(Math.sqrt(a));
  const distance = R * c; 
  return distance;
};

const computeMetrics = (distances, dataToSave) => {
  const sortedDistances = distances.slice().sort((a, b) => a - b);
  const Q1 = math.quantileSeq(sortedDistances, 0.25);
  const Q3 = math.quantileSeq(sortedDistances, 0.75);
  const IQR = Q3 - Q1;
  const lowerBound = Q1 - 1.5 * IQR;
  const upperBound = Q3 + 1.5 * IQR;

  // Identify outliers and add isOutlier flag
  for (let i = 0; i < distances.length; i++) {
    const distance = distances[i];
    const isOutlier = distance < lowerBound || distance > upperBound;
    dataToSave[i].isOutlier = isOutlier;
  }

  // Metrics including outliers
  const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const varianceDistance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / (distances.length - 1);
  const stdDevDistance = Math.sqrt(varianceDistance);
  const ratioIncludingOutliers = meanDistance / stdDevDistance;
  let k = 0;
  if (ratioIncludingOutliers > 1.4) {
    k = 1.2815;
  } else {
    k = 1.6435 - (0.999556 * ratioIncludingOutliers) + (0.923237 * Math.pow(ratioIncludingOutliers, 2)) - (0.282533 * Math.pow(ratioIncludingOutliers, 3));
  }
  const ce90 = Math.abs(meanDistance) + k * stdDevDistance;

  const allMetrics = {
    mean: meanDistance,
    stdDev: stdDevDistance,
    ce90: ce90,
  };

  // Metrics excluding outliers
  const nonOutlierDistances = dataToSave
    .filter(point => !point.isOutlier)
    .map(point => point.distance);

  const meanDistanceNoOutliers = nonOutlierDistances.reduce((sum, d) => sum + d, 0) / nonOutlierDistances.length;
  const varianceDistanceNoOutliers = nonOutlierDistances.reduce((sum, d) => sum + Math.pow(d - meanDistanceNoOutliers, 2), 0) / (nonOutlierDistances.length - 1);
  const stdDevDistanceNoOutliers = Math.sqrt(varianceDistanceNoOutliers);

  const ratioExcludingOutliers = meanDistanceNoOutliers / stdDevDistanceNoOutliers;
  let k1 = 0;
  if (ratioExcludingOutliers > 1.4) {
    k1 = 1.2815;
  } else {
    k1 = 1.6435 - (0.999556 * ratioExcludingOutliers) + (0.923237 * Math.pow(ratioExcludingOutliers, 2)) - (0.282533 * Math.pow(ratioExcludingOutliers, 3));
  }

  const ce90NoOutliers = Math.abs(meanDistanceNoOutliers) + (k1 * stdDevDistanceNoOutliers);

  const nonOutlierMetrics = {
    mean: meanDistanceNoOutliers,
    stdDev: stdDevDistanceNoOutliers,
    ce90: ce90NoOutliers,
  };

  return { allMetrics, nonOutlierMetrics, updatedData: dataToSave };
};

module.exports = {
  calculateDistance,
  computeMetrics
};
