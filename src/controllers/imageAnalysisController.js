
import { z } from "zod";

import { analyzePropertyImages } from "../services/imageAnalysis.service.js";

import { calculateImageScores } from "../services/imageScoring.service.js";

const imageEvaluationSchema = z.object({
  propertyId: z.string().min(1),

  title: z.string().min(1),

  description: z.string().min(1),

  type: z.string().optional(),

  address: z.record(z.string(), z.unknown()).optional(),

  details: z.record(z.string(), z.unknown()).optional(),

  listingPhotos: z.array(z.string().url()).min(1)
});

export const evaluatePropertyImages = async (req, res) => {
  try {
    const validation = imageEvaluationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validation.error.issues
      });
    }

    const {
      propertyId,
      title,
      description,
      type,
      address,
      details,
      listingPhotos
    } = validation.data;

    // Step 1: Analyze images using Groq Vision.
    const analysis = await analyzePropertyImages({
      photoUrls: listingPhotos,

      property: {
        title,
        description,
        type,
        address,
        details
      }
    });

    // Step 2: Calculate scores in our backend.
    const scores = calculateImageScores(analysis);

    // Step 3: Return complete evaluation.
    return res.status(200).json({
      success: true,

      propertyId,

      imageEvaluation: {
        status: analysis.status,

        ...scores,

        photos: analysis.photos,

        flags: analysis.flags,

        suggestions: analysis.suggestions,

        summary: analysis.summary,

        analyzedPhotoCount: analysis.analyzedPhotoCount,

        totalPhotoCount: analysis.totalPhotoCount
      }
    });

  } catch (error) {
    console.error("Image evaluation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to evaluate property images",
      error: error.message
    });
  }
};
