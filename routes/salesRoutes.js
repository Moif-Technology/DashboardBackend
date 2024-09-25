import express from 'express';
import { getAreaSales, getBranches, getMonthlySales, getSalesDetails } from '../controllers/salesController.js';


const router = express.Router();

router.get("/salesDetails", getSalesDetails);
router.get("/monthlySales",getMonthlySales);
router.get("/areaSales",getAreaSales)
router.get("/fetchBranches",getBranches)

export default router;