import express from "express";
import { getCounterCloseDetails } from "../controllers/counterCloseController.js";

const router = express.Router();

router.get("/CounterClose",getCounterCloseDetails)

export default router;
