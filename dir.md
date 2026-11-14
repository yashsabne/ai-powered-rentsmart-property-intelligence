# Project Structure

```text
ai-powered-rentsmart-property-intelligence/
├── app.js
├── package.json
├── package-lock.json
├── .env.example
├── README.md
└── src/
    ├── config/
    │   ├── ai.js
    │   └── db.js
    ├── controllers/
    │   ├── evaluationController.js
    │   └── imageAnalysisController.js
    ├── middleware/
    │   └── serviceAuth.js
    ├── models/
    │   └── Evaluation.js
    ├── routes/
    │   └── evaluationRoutes.js
    └── services/
        ├── propertyAnalysis.service.js
        ├── imageAnalysis.service.js
        ├── scoring.service.js
        ├── imageScoring.service.js
        └── combinedScoring.service.js
```

See [README.md](README.md) for the service architecture, Mermaid diagrams, evaluation pipeline, API reference, scoring logic, and setup instructions.
