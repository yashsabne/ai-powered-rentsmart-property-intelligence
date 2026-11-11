
import groq from "../config/ai.js";
import { z } from "zod";

const photoSchema = z.object({
  photoNumber: z.number().int().positive(),

  roomType: z.string(),

  // How visually good the photo is.
  clarity: z.number().min(0).max(100),

  // How well the image appears to match the listing.
  relevance: z.number().min(0).max(100),

  observations: z.array(z.string()).default([]),

  matchNotes: z.string().default("")
});

const imageAnalysisSchema = z.object({
  photos: z.array(photoSchema),

  // Consistency between the uploaded photos.
  visualConsistency: z.number().min(0).max(100),

  flags: z.array(z.string()).default([]),

  suggestions: z.array(z.string()).default([]),

  summary: z.string()
});

export const analyzePropertyImages = async ({
  photoUrls,
  property
}) => {
  if (!photoUrls || photoUrls.length === 0) {
    return {
      status: "NOT_PROVIDED",
      photoQualityScore: null,
      propertyRelevanceScore: null,
      visualConsistencyScore: null,
      reviewRecommendation: false,
      severity: "NONE",
      photos: [],
      flags: [],
      suggestions: [],
      summary: "No property photos were provided.",
      analyzedPhotoCount: 0,
      totalPhotoCount: 0
    };
  }

  // Analyze a maximum of 3 photos per request for now.
  const photosToAnalyze = photoUrls.slice(0, 3);

  const imageContent = photosToAnalyze.map((photoUrl, index) => {
    const url = new URL(photoUrl);

    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS image URLs are supported.");
    }

    return {
      type: "image_url",
      image_url: {
        url: photoUrl
      }
    };
  });

 
const prompt = `
You are RentSmart's property image evaluator.

Evaluate the uploaded photos against this listing:

Title: ${property.title}
Description: ${property.description}
Property Type: ${property.type || "Not provided"}
Address: ${JSON.stringify(property.address || {})}
Details: ${JSON.stringify(property.details || {})}

Evaluate each photo independently on these dimensions:

1. CLARITY (0-100)
Assess sharpness, lighting, visibility and usability.
Do not penalize ordinary furniture, older interiors or
lack of luxury.

2. RELEVANCE (0-100)
Assess whether the image plausibly belongs to the
advertised property type and description.

Rules:
- Bedrooms, kitchens, bathrooms and living rooms are relevant
  to apartment listings.
- Apartments can have pools, gardens, balconies and luxury interiors.
- Do not assume large rooms or swimming pools indicate villas.
- Do not infer property size, price or category from appearance.
- Only give very low scores when there is strong visual evidence
  of a genuine mismatch.
- If uncertain, use a moderate score.

3. VISUAL CONSISTENCY (0-100)
Assess whether the photos plausibly show the same property.

Rules:
- Different rooms, lighting, furniture and camera angles are normal.
- Different decoration styles do not prove different properties.
- Look for substantial architectural or structural contradictions.
- If uncertain, avoid extreme scores.

4. CONFIDENCE (0-100)
Estimate confidence in each photo's relevance assessment.
Confidence and relevance are different measurements.
Do not treat uncertainty as proof of mismatch.

GENERAL RULES:
- Never claim fraud, fake listings, stolen photos or ownership.
- Do not invent visual details.
- Do not claim stock photos without strong evidence.
- Use cautious language such as "appears inconsistent".
- Poor image quality alone is not evidence of a mismatch.
- Missing room angles are not serious flags.
- Suggestions must be practical and specific.
- Avoid duplicate flags.

Return ONLY valid JSON in this structure:

{
  "photos": [
    {
      "photoNumber": 1,
      "roomType": "Living Room",
      "clarity": 85,
      "relevance": 90,
      "confidence": 90,
      "observations": [
        "The room is clearly visible."
      ],
      "matchNotes": "Appears relevant to the listing."
    }
  ],
  "visualConsistency": 85,
  "flags": [],
  "suggestions": [],
  "summary": "The photos are generally suitable."
}

Use these scoring guidelines:
- 85-100: Strong
- 65-84: Good
- 40-64: Uncertain or moderate
- 20-39: Poor
- 0-19: Very poor

Analyze every supplied photo in order.
All scores must be integers from 0 to 100.
Return valid JSON only.
`;


  const response = await groq.chat.completions.create({
    model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",

    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          ...imageContent
        ]
      }
    ],

    response_format: {
      type: "json_object"
    },

    temperature: 0.2,
    max_completion_tokens: 2000
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned an empty image analysis response.");
  }

  const parsedResponse = JSON.parse(content);

  const validatedAnalysis = imageAnalysisSchema.parse(parsedResponse);

  return {
    status: "COMPLETED",
    ...validatedAnalysis,
    analyzedPhotoCount: photosToAnalyze.length,
    totalPhotoCount: photoUrls.length
  };
};
