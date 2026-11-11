
export const calculateImageScores = (analysis) => {
  if (analysis.status === "NOT_PROVIDED") {
    return {
      photoQualityScore: null,
      propertyRelevanceScore: null,
      visualConsistencyScore: null,
      reviewRecommendation: false,
      severity: "NONE"
    };
  }

  const photos = analysis.photos;

  if (!photos || photos.length === 0) {
    throw new Error("No photo analysis data available.");
  }

  const calculateAverage = (values) => {
    const total = values.reduce((sum, value) => sum + value, 0);

    return Math.round(total / values.length);
  };

  // Independent scores.
  const photoQualityScore = calculateAverage(
    photos.map((photo) => photo.clarity)
  );

  const propertyRelevanceScore = calculateAverage(
    photos.map((photo) => photo.relevance)
  );

  const visualConsistencyScore = analysis.visualConsistency;

  /*
    Review severity is based on property mismatch,
    NOT photo clarity.

    This prevents ordinary low-quality photos from
    being treated as suspicious.
  */

  let severity = "NONE";

  if (propertyRelevanceScore < 25) {
    severity = "HIGH";
  } else if (
    propertyRelevanceScore < 45 ||
    visualConsistencyScore < 35
  ) {
    severity = "MODERATE";
  }

  return {
    photoQualityScore,
    propertyRelevanceScore,
    visualConsistencyScore,
    reviewRecommendation: severity !== "NONE",
    severity
  };
};
