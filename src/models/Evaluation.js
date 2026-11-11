
import mongoose from "mongoose";

const breakdownSchema = new mongoose.Schema(
  {
    completeness: Number,
    consistency: Number,
    descriptionQuality: Number
  },
  { _id: false }
);

const textEvaluationSchema = new mongoose.Schema(
  {
    score: Number,
    rating: String,
    breakdown: breakdownSchema,
    flags: [String],
    suggestions: [String],
    summary: String,
    model: String
  },
  { _id: false }
);

const photoSchema = new mongoose.Schema(
  {
    photoNumber: Number,
    roomType: String,
    clarity: Number,
    relevance: Number,
    confidence: Number,
    observations: [String],
    matchNotes: String
  },
  { _id: false }
);

const imageEvaluationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["COMPLETED", "NOT_PROVIDED"],
      default: "NOT_PROVIDED"
    },

    photoQualityScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100
    },

    propertyRelevanceScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100
    },

    visualConsistencyScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100
    },

    reviewRecommendation: {
      type: Boolean,
      default: false
    },

    severity: {
      type: String,
      enum: ["NONE", "MODERATE", "HIGH"],
      default: "NONE"
    },

    photos: [photoSchema],
    flags: [String],
    suggestions: [String],
    summary: String,

    analyzedPhotoCount: {
      type: Number,
      default: 0
    },

    totalPhotoCount: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const scoringDetailsSchema = new mongoose.Schema(
  {
    textScore: Number,
    imageScore: {
      type: Number,
      default: null
    },
    weights: {
      text: Number,
      image: Number
    }
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    propertyId: {
      type: String,
      required: true,
      index: true
    },

    listingQualityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    rating: {
      type: String,
      enum: [
        "EXCELLENT",
        "GOOD",
        "MODERATE",
        "NEEDS_IMPROVEMENT"
      ],
      required: true
    },

    // Existing text evaluation fields.
    breakdown: breakdownSchema,

    flags: [String],
    suggestions: [String],
    summary: String,

    // New structured evaluation fields.
    textEvaluation: textEvaluationSchema,
    imageEvaluation: imageEvaluationSchema,
    scoringDetails: scoringDetailsSchema,

    model: String,

    imageModel: String,

    modelVersion: {
      type: String,
      default: "v1"
    },

    propertySnapshot: {
      type: mongoose.Schema.Types.Mixed
    },

    evaluatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

evaluationSchema.index({
  propertyId: 1,
  evaluatedAt: -1
});

export default mongoose.model("Evaluation", evaluationSchema);
