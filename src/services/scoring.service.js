
export const calculateListingScore = (analysis) => {
    const weights = {
        completeness: 0.40,
        consistency: 0.35,
        descriptionQuality: 0.25,
    };

    const score = (
        analysis.completeness * weights.completeness +
        analysis.consistency * weights.consistency +
        analysis.descriptionQuality * weights.descriptionQuality
    );

    const finalScore = Math.round(score);

    let rating;

    if (finalScore >= 85) rating = "EXCELLENT";
    else if (finalScore >= 70) rating = "GOOD";
    else if (finalScore >= 50) rating = "MODERATE";
    else rating = "NEEDS_IMPROVEMENT";

    return {
        score: finalScore,
        rating,
    };
};
