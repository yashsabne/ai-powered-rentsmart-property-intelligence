
import { z } from "zod";

import { analyzeProperty } from "../services/propertyAnalysis.service.js";
import { analyzePropertyImages } from "../services/imageAnalysis.service.js";

import { calculateListingScore } from "../services/scoring.service.js";
import { calculateImageScores } from "../services/imageScoring.service.js";
import { calculateOverallListingScore } from "../services/combinedScoring.service.js";

import Evaluation from "../models/Evaluation.js";

const propertySchema = z.object({
  propertyId: z.string().min(1),

  title: z.string().min(3),
  description: z.string().min(10),
  price: z.number().positive(),

  buyOrSell: z.string().optional(),
  type: z.string().optional(),

  address: z.object({
    street: z.string().optional(),
    aptSuite: z.string().optional(),
    city: z.string().optional(),
    pincode: z.union([z.string(), z.number()]).optional(),
    country: z.string().optional()
  }).optional(),

  details: z.record(z.any()).optional(),

  amenities: z.array(z.string()).default([]),

  // Images are optional for combined evaluation.
  listingPhotos: z.array(z.string().url()).default([])
});

const validateProperty = (req, res) => {
  const validation = propertySchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(422).json({
      success: false,
      code: "INVALID_PROPERTY_DATA",
      message: "Insufficient or invalid property information for AI evaluation.",
      errors: validation.error.issues.map(issue => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  return validation.data;
};

const uniqueItems = (...arrays) => {
  return [...new Set(arrays.flat().filter(Boolean))];
};

// ------------------------------------------
// TEXT-ONLY EVALUATION (EXISTING ENDPOINT)
// ------------------------------------------

export const evaluateProperty = async (req, res) => {
  try {
    const validation = propertySchema.safeParse(req.body);

    const property = validateProperty(req, res);

    if (!property) return;

    const analysis = await analyzeProperty(property);

    const scoring = calculateListingScore(analysis);

    const evaluation = await Evaluation.create({
      propertyId: property.propertyId,

      listingQualityScore: scoring.score,
      rating: scoring.rating,

      breakdown: {
        completeness: analysis.completeness,
        consistency: analysis.consistency,
        descriptionQuality: analysis.descriptionQuality
      },

      textEvaluation: {
        score: scoring.score,
        rating: scoring.rating,

        breakdown: {
          completeness: analysis.completeness,
          consistency: analysis.consistency,
          descriptionQuality: analysis.descriptionQuality
        },

        flags: analysis.flags,
        suggestions: analysis.suggestions,
        summary: analysis.summary,
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b"
      },

      imageEvaluation: {
        status: "NOT_PROVIDED"
      },

      scoringDetails: {
        textScore: scoring.score,
        imageScore: null,
        weights: {
          text: 100,
          image: 0
        }
      },

      flags: analysis.flags,
      suggestions: analysis.suggestions,
      summary: analysis.summary,

      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      modelVersion: "v1",

      propertySnapshot: property,

      evaluatedAt: new Date()
    });

    return res.status(201).json({
      success: true,
      evaluationId: evaluation._id,
      propertyId: property.propertyId,

      evaluation: {
        listingQualityScore: evaluation.listingQualityScore,
        rating: evaluation.rating,
        breakdown: evaluation.breakdown,
        flags: evaluation.flags,
        suggestions: evaluation.suggestions,
        summary: evaluation.summary,
        evaluatedAt: evaluation.evaluatedAt
      },

      disclaimer: "AI-assisted listing quality assessment. This is not proof of property ownership or legal verification."
    });

  } catch (error) {
    console.error("PROPERTY EVALUATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Property evaluation failed",
      error: process.env.NODE_ENV === "development"
        ? error.message
        : undefined
    });
  }
};


// ------------------------------------------
// COMPLETE EVALUATION (TEXT + IMAGES)
// ------------------------------------------

export const evaluateCompleteProperty = async (req, res) => {
  try {
    const property = validateProperty(req, res);

    if (!property) return;
 

    // 1. Run text analysis.
    const textAnalysis = await analyzeProperty(property);

    const textScoring = calculateListingScore(textAnalysis);

    // 2. Run image analysis.
    // The image service supports empty photo arrays.
    const imageAnalysis = await analyzePropertyImages({
      photoUrls: property.listingPhotos,

      property: {
        title: property.title,
        description: property.description,
        type: property.type,
        address: property.address,
        details: property.details
      }
    });

    // 3. Calculate image scores in our backend.
    const imageScoring = calculateImageScores(imageAnalysis);

    // 4. Calculate combined listing score.
    const overallScoring = calculateOverallListingScore({
      textScore: textScoring,
      imageScores: imageScoring
    });

    // 5. Prepare image evaluation data.
    const imageEvaluation = {
      status: imageAnalysis.status,

      ...imageScoring,

      photos: imageAnalysis.photos || [],

      flags: imageAnalysis.flags || [],

      suggestions: imageAnalysis.suggestions || [],

      summary: imageAnalysis.summary,

      analyzedPhotoCount: imageAnalysis.analyzedPhotoCount || 0,

      totalPhotoCount: imageAnalysis.totalPhotoCount || 0
    };

    // 6. Merge flags and suggestions.
    const combinedFlags = uniqueItems(
      textAnalysis.flags,
      imageEvaluation.flags
    );

    const combinedSuggestions = uniqueItems(
      textAnalysis.suggestions,
      imageEvaluation.suggestions
    );

    // 7. Create a combined summary.
    const combinedSummary = [
      `Text evaluation: ${textAnalysis.summary}`,
      `Image evaluation: ${imageEvaluation.summary}`
    ].filter(Boolean).join(" ");

    // 8. Save everything in ONE MongoDB document.
    const evaluation = await Evaluation.create({
      propertyId: property.propertyId,

      listingQualityScore: overallScoring.score,
      rating: overallScoring.rating,

      breakdown: {
        completeness: textAnalysis.completeness,
        consistency: textAnalysis.consistency,
        descriptionQuality: textAnalysis.descriptionQuality
      },

      textEvaluation: {
        score: textScoring.score,
        rating: textScoring.rating,

        breakdown: {
          completeness: textAnalysis.completeness,
          consistency: textAnalysis.consistency,
          descriptionQuality: textAnalysis.descriptionQuality
        },

        flags: textAnalysis.flags,
        suggestions: textAnalysis.suggestions,
        summary: textAnalysis.summary,

        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b"
      },

      imageEvaluation,

      scoringDetails: {
        textScore: overallScoring.textScore,
        imageScore: overallScoring.imageScore,
        weights: overallScoring.weights
      },

      flags: combinedFlags,
      suggestions: combinedSuggestions,
      summary: combinedSummary,

      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      imageModel: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",

      modelVersion: "v1",

      propertySnapshot: property,

      evaluatedAt: new Date()
    });

    // 9. Return complete evaluation.
    return res.status(201).json({
      success: true,

      evaluationId: evaluation._id,
      propertyId: property.propertyId,

      evaluation: {
        listingQualityScore: evaluation.listingQualityScore,
        rating: evaluation.rating,

        scoringDetails: evaluation.scoringDetails,

        textEvaluation: evaluation.textEvaluation,

        imageEvaluation: evaluation.imageEvaluation,

        flags: evaluation.flags,
        suggestions: evaluation.suggestions,
        summary: evaluation.summary,

        evaluatedAt: evaluation.evaluatedAt
      },

      disclaimer: "AI-assisted property listing assessment. This is not proof of property ownership or legal verification."
    });

  } catch (error) {
    console.error("COMPLETE PROPERTY EVALUATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Complete property evaluation failed",
      error: process.env.NODE_ENV === "development"
        ? error.message
        : undefined
    });
  }
};


// ------------------------------------------
// EVALUATION HISTORY
// ------------------------------------------

export const getEvaluationHistory = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const evaluations = await Evaluation.find({ propertyId })
      .sort({ evaluatedAt: -1 })
      .lean();

    if (!evaluations.length) {
      return res.status(404).json({
        success: false,
        message: "No evaluation history found"
      });
    }

    return res.status(200).json({
      success: true,
      propertyId,
      totalEvaluations: evaluations.length,
      evaluations
    });

  } catch (error) {
    console.error("EVALUATION HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch evaluation history"
    });
  }
};
