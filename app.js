
import express from "express";
import cors from "cors";
import "dotenv/config";

import evaluationRoutes from "./src/routes/evaluationRoutes.js";
import connectDB from "./src/config/db.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "RentSmart Property Intelligence API is running"
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "rentsmart-property-intelligence",
        status: "healthy",
        timestamp: new Date().toISOString()
    });
});

app.use("/api/evaluations", evaluationRoutes);

const PORT = process.env.PORT || 5007;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`AI service running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
