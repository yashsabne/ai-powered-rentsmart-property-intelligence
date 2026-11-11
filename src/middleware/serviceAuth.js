
export const serviceAuth = (req, res, next) => {
    const serviceKey = req.headers["x-service-key"];

    if (!process.env.SERVICE_API_KEY) {
        return res.status(503).json({
            success: false,
            message: "Service authentication is not configured",
        });
    }

    if (serviceKey !== process.env.SERVICE_API_KEY) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized service request",
        });
    }

    next();
};
