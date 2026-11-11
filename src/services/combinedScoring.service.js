
const getRating = (score) => {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "MODERATE";
  return "NEEDS_IMPROVEMENT";
};

export const calculateOverallListingScore = ({
  textScore,
  imageScores
}) => {
  // If no images were provided, use the text score alone. 
  if (imageScores.photoQualityScore === null) {
    return {
      score: textScore.score,
      rating: textScore.rating,
      textScore: textScore.score,
      imageScore: null,
      weights: {
        text: 100,
        image: 0
      }
    };
  }

  // Calculate image score from independent image dimensions.
  const imageScore = Math.round(
    imageScores.photoQualityScore * 0.40 +
    imageScores.propertyRelevanceScore * 0.35 +
    imageScores.visualConsistencyScore * 0.25
  );

  // Combine text and image scores.
  const overallScore = Math.round(
    textScore.score * 0.80 +
    imageScore * 0.20
  );

  return {
    score: overallScore,
    rating: getRating(overallScore),
    textScore: textScore.score,
    imageScore,
    weights: {
      text: 80,
      image: 20
    }
  };
};
