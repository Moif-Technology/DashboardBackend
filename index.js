import express from "express";
import cors from "cors";
import {
  connectToCompanyDetails,
  connectToDashboard,
} from "./config/dbConfig.js";

import salesRoutes from "./routes/salesRoutes.js";
import customerRoute from "./routes/customerRoute.js";
import loginRoute from "./routes/loginRoute.js";
import counterRoutes from "./routes/counterRoute.js";
import reportRoutes from "./routes/reportRoute.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "*", // Allow all origins for testing purposes
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

async function startServer() {
  try {
    // Connect to both databases
    await connectToCompanyDetails();
    await connectToDashboard();

    // Start listening only after successful database connections
    app.use("/", salesRoutes);
    app.use("/", customerRoute);
    app.use("/", loginRoute);
    app.use("/", counterRoutes);
    app.use("/", reportRoutes);
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to databases:", error);
    process.exit(1); // Exit process with failure
  }
}

// Start the server
startServer();
