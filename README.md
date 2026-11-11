# RentSmart Property Intelligence

Independent AI-powered property evaluation microservice for RentSmart.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `PORT=5005`.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Check health:

   ```text
   GET http://localhost:5005/health
   ```

The initial health endpoint checks that the Express service is running. MongoDB and Gemini integration will be added in later steps.
