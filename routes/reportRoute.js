import express from 'express';
import { fastForwardItems, getGroupReport, getItemSaleReport } from '../controllers/reportController.js';


const router = express.Router();


router.get("/getItemReport",getItemSaleReport);
router.get("/getGroupReport",getGroupReport);
router.get("/getForwardItemsReport",fastForwardItems);

export default router;
