import express from 'express';
import { getGroupReport, getItemSaleReport } from '../controllers/reportController.js';


const router = express.Router();


router.get("/getItemReport",getItemSaleReport);
router.get("/getGroupReport",getGroupReport);

export default router;
