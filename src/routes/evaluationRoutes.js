
import express from "express";

import {
  evaluateProperty,
  evaluateCompleteProperty,
  getEvaluationHistory
} from "../controllers/evaluationController.js";

import {
  evaluatePropertyImages
} from "../controllers/imageAnalysisController.js";

import { serviceAuth } from "../middleware/serviceAuth.js";

const router = express.Router();

// Text-only evaluation
router.post("/", serviceAuth, evaluateProperty);

// Image-only evaluation (existing endpoint)
router.post("/images", serviceAuth, evaluatePropertyImages);

// Combined text + image evaluation (new endpoint)
router.post("/complete", serviceAuth, evaluateCompleteProperty);

// Evaluation history
router.get("/:propertyId/history", serviceAuth, getEvaluationHistory);

export default router;
