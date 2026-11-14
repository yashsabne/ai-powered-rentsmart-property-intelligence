# RentSmart Property Intelligence

An AI-powered property listing evaluation microservice used by RentSmart. It evaluates listing content and, when photos are supplied, the visual quality and relevance of property images. The service produces a structured quality score, flags, improvement suggestions, and an evaluation summary.

> **Scope:** This is an AI-assisted listing-quality assessment. It does not verify property ownership, establish legal status, or prove that a listing is genuine.

## Architecture

### Service architecture

\`\`\`mermaid
flowchart LR
    RS["RentSmart<br/>Property Service / Backend"] -->|"HTTP + x-service-key"| API["Express API<br/>Property Intelligence"]
    API --> AUTH["Service-key Middleware"]
    AUTH --> CTRL["Evaluation Controllers"]
    CTRL --> TXT["Property Analysis<br/>Groq LLM"]
    CTRL --> IMG["Image Analysis<br/>Groq Vision"]
    TXT --> TS["Text Scoring"]
    IMG --> IS["Image Scoring"]
    TS --> COMB["Combined Score"]
    IS --> COMB
    COMB --> DB[("MongoDB<br/>Evaluation Collection")]
    DB --> RESP["Structured API Response"]
    COMB --> RESP
\`\`\`

### Combined evaluation flow

\`\`\`mermaid
flowchart TD
    A["POST /api/evaluations/complete"] --> B["Validate request with Zod"]
    B --> C["Analyze listing text and structured fields"]
    C --> D["Groq LLM returns JSON analysis"]
    D --> E["Validate analysis schema"]
    E --> F["Calculate text score<br/>40% completeness · 35% consistency · 25% description"]
    F --> G["Select up to 3 HTTPS listing photos"]
    G --> H{"Photos supplied?"}
    H -- "Yes" --> I["Groq Vision analyzes each selected photo<br/>and cross-photo visual consistency"]
    H -- "No" --> J["Image evaluation = NOT_PROVIDED"]
    I --> K["Calculate image dimensions<br/>clarity · relevance · visual consistency"]
    J --> L["Use text score only"]
    K --> M["Calculate overall score<br/>80% text + 20% image"]
    M --> N["Merge flags, suggestions and summaries"]
    L --> N
    N --> O["Persist one Evaluation document"]
    O --> P["Return scores and evaluation details"]
\`\`\`

### Evaluation routes

\`\`\`mermaid
flowchart TB
    CLIENT["RentSmart Backend"] --> AUTH["x-service-key check"]
    AUTH --> R{"API route"}
    R --> T["POST /"]
    R --> I["POST /images"]
    R --> C["POST /complete"]
    R --> H["GET /:propertyId/history"]
    T --> TEXT["Text analysis + text score<br/>Persist evaluation"]
    I --> IMAGE["Image analysis + image score<br/>Return result; no persistence"]
    C --> BOTH["Text + image analysis<br/>Combined score + persist evaluation"]
    H --> HISTORY["Read stored evaluations<br/>Newest first"]
\`\`\`

## How evaluation works

### 1. Text analysis

The property analysis service sends the listing's structured and descriptive information to the configured Groq chat model. The prompt asks the model to assess:

| Dimension | What it evaluates | Weight in text score |
|---|---|---:|
| Completeness | Presence of useful listing information across structured fields and description | 40% |
| Consistency | Contradictions between structured property data and the description | 35% |
| Description quality | Clarity, relevance, professionalism and usefulness | 25% |

The model is expected to return scores from 0–100, flags, suggestions and a summary. The response is parsed and validated with Zod. The text analysis makes up to **two attempts** when output is empty, invalid or fails validation.

\`\`\`text
Text score =
  completeness × 0.40
+ consistency × 0.35
+ descriptionQuality × 0.25
\`\`\`

### 2. Image analysis

When photo URLs are present, the image analysis service sends up to **three photos per evaluation** to the configured Groq vision model. Only HTTPS image URLs are accepted.

For each photo, the model returns:
- Room or scene type
- Clarity score (0–100)
- Listing relevance score (0–100)
- Confidence score (0–100)
- Observations and match notes

It also evaluates visual consistency across the selected photos and returns flags, suggestions and a summary. The backend calculates the photo-quality and property-relevance averages; visual consistency comes from the model's cross-photo assessment.

\`\`\`text
Image score =
  photo quality × 0.40
+ property relevance × 0.35
+ visual consistency × 0.25
\`\`\`

Image review severity is based on relevance and visual consistency—not clarity alone:

| Condition | Severity |
|---|---|
| Property relevance below 25 | HIGH |
| Property relevance below 45, or visual consistency below 35 | MODERATE |
| Otherwise | NONE |

A non-\`NONE\` severity sets \`reviewRecommendation\` to \`true\`. These are review signals, not fraud or ownership findings.

### 3. Overall score

When image scores are available:

\`\`\`text
Overall score = text score × 0.80 + image score × 0.20
\`\`\`

When no photos are provided, the overall score is the text score and the weights are 100% text / 0% image.

| Overall score | Rating |
|---:|---|
| 85–100 | EXCELLENT |
| 70–84 | GOOD |
| 50–69 | MODERATE |
| 0–49 | NEEDS_IMPROVEMENT |

## API

Base path: \`/api/evaluations\`

All evaluation routes require the following header:

\`\`\`http
x-service-key: <SERVICE_API_KEY>
\`\`\`

The service responds with **503** when \`SERVICE_API_KEY\` is not configured and **401** when the supplied key does not match.

### 1. Text-only evaluation

\`\`\`http
POST /api/evaluations
Content-Type: application/json
x-service-key: <SERVICE_API_KEY>
\`\`\`

Evaluates listing text and structured fields, calculates the text score, and stores an evaluation document. The image status is recorded as \`NOT_PROVIDED\`.

### 2. Image-only evaluation

\`\`\`http
POST /api/evaluations/images
Content-Type: application/json
x-service-key: <SERVICE_API_KEY>
\`\`\`

Analyzes listing photos and returns image scores and review signals. This endpoint does **not** create an \`Evaluation\` document.

### 3. Combined text and image evaluation

\`\`\`http
POST /api/evaluations/complete
Content-Type: application/json
x-service-key: <SERVICE_API_KEY>
\`\`\`

Runs both analyses, calculates the overall listing score, merges flags and suggestions, and persists the complete evaluation in one MongoDB document. If \`listingPhotos\` is empty or omitted, it falls back to text-only scoring.

### 4. Evaluation history

\`\`\`http
GET /api/evaluations/:propertyId/history
x-service-key: <SERVICE_API_KEY>
\`\`\`

Returns stored evaluations for the property, ordered by \`evaluatedAt\` descending. Returns **404** when no history is found.

### Request body

The text and combined endpoints accept the following shape. The image-only endpoint uses a similar subset and requires at least one photo.

\`\`\`json
{
  "propertyId": "property-id",
  "title": "2 BHK apartment near the city centre",
  "description": "A well-maintained apartment with...",
  "price": 25000,
  "buyOrSell": "rent",
  "type": "apartment",
  "address": {
    "street": "Example Road",
    "city": "Surat",
    "pincode": "395007",
    "country": "India"
  },
  "details": {
    "bedrooms": 2,
    "bathrooms": 2,
    "area": 1100
  },
  "amenities": ["Parking", "Lift"],
  "listingPhotos": [
    "https://example.com/property-photo-1.jpg",
    "https://example.com/property-photo-2.jpg"
  ]
}
\`\`\`

**Validation notes**
- \`propertyId\` must be a non-empty string.
- \`title\` must contain at least 3 characters; \`description\` at least 10.
- \`price\` must be a positive number.
- \`amenities\` defaults to an empty array.
- \`listingPhotos\` defaults to an empty array on text/combined evaluation; each supplied value must be a valid URL.
- Image analysis only accepts HTTPS photo URLs and analyzes at most the first three.

### Response shape

The text-only and combined endpoints return \`201 Created\` with an \`evaluationId\`, \`propertyId\`, an \`evaluation\` object, and a disclaimer. The combined response includes \`scoringDetails\`, \`textEvaluation\`, and \`imageEvaluation\`. The image-only endpoint returns \`200 OK\` with an \`imageEvaluation\` object and does not return an evaluation record ID.

Validation errors return \`400\`; unexpected evaluation failures return \`500\`. In development mode, the evaluation controller may include the underlying error message.

## Data model

Each persisted evaluation is stored in MongoDB's \`evaluations\` collection through the Mongoose \`Evaluation\` model.

The document includes:
- \`propertyId\` and overall \`listingQualityScore\` / \`rating\`
- Text breakdown, flags, suggestions and summary
- Structured \`textEvaluation\` and \`imageEvaluation\` objects
- \`scoringDetails\`, including the component scores and weights
- Configured model identifiers and \`modelVersion\`
- \`propertySnapshot\` captured at evaluation time
- \`evaluatedAt\` and Mongoose timestamps

An index supports lookup by \`propertyId\`; a compound index on \`propertyId\` and \`evaluatedAt\` supports history retrieval in reverse chronological order.

## Project structure

\`\`\`text
.
├── app.js
├── package.json
├── .env.example
└── src/
    ├── config/
    │   ├── ai.js                       # Groq SDK client
    │   └── db.js                       # MongoDB connection
    ├── controllers/
    │   ├── evaluationController.js     # Text, combined and history endpoints
    │   └── imageAnalysisController.js # Image-only endpoint
    ├── middleware/
    │   └── serviceAuth.js              # x-service-key authentication
    ├── models/
    │   └── Evaluation.js               # Mongoose evaluation schema
    ├── routes/
    │   └── evaluationRoutes.js         # Protected API routes
    └── services/
        ├── propertyAnalysis.service.js # Groq text analysis + Zod validation
        ├── imageAnalysis.service.js    # Groq vision analysis + Zod validation
        ├── scoring.service.js          # Text score
        ├── imageScoring.service.js     # Image scores + review severity
        └── combinedScoring.service.js  # Overall score and rating
\`\`\`

## Local setup

### Requirements

- Node.js (ES modules supported)
- MongoDB connection string
- Groq API key with access to the configured text and vision models

### Install and run

\`\`\`bash
git clone https://github.com/yashsabne/ai-powered-rentsmart-property-intelligence.git
cd ai-powered-rentsmart-property-intelligence
npm install
cp .env.example .env
npm run dev
\`\`\`

On Windows PowerShell, use \`Copy-Item .env.example .env\` instead of \`cp\`.

Set the environment variables in \`.env\`:

| Variable | Purpose |
|---|---|
| \`PORT\` | HTTP port; defaults to \`5007\` |
| \`MONGO_URI\` | MongoDB connection URI |
| \`GROQ_API_KEY\` | Groq API key |
| \`GROQ_MODEL\` | Text analysis model; code default: \`openai/gpt-oss-20b\` |
| \`GROQ_VISION_MODEL\` | Image analysis model; code default: \`qwen/qwen3.8-27b\` |
| \`SERVICE_API_KEY\` | Shared key expected in the \`x-service-key\` header |
| \`NODE_ENV\` | Controls whether evaluation errors include details in controller responses |

The app connects to MongoDB before it starts listening. If the database connection fails, startup exits with an error.

### Health checks

\`\`\`http
GET /
GET /health
\`\`\`

These root and health routes are public and do not use the service-key middleware.

## Runtime dependencies

- **Express** — HTTP server and routing
- **Groq SDK** — chat and vision model requests
- **MongoDB + Mongoose** — evaluation persistence and history
- **Zod** — request and model-output validation
- **dotenv** — environment configuration
- **cors** — CORS middleware

## Notes and limitations

- Model output is treated as untrusted data and validated before being used.
- Text analysis retries once after an unsuccessful response/validation attempt; image analysis does not implement the same retry loop.
- Image evaluation is limited to the first three photos per request.
- The combined route stores one document containing both text and image evaluation details.
- The image-only route calculates and returns image results but does not persist them.
- The service evaluates listing presentation and internal consistency; it does not perform ownership, document, location, price-market, or legal verification.

## License and usage

© 2026 Yash Navnath Sabne. All rights reserved.

The source code, design, and original implementation are proprietary. Unauthorized copying, redistribution, or commercial use without prior written permission is prohibited. Contributions and constructive suggestions are welcome; please open an issue to discuss a proposed improvement before submitting substantial changes.
