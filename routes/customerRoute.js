import express from 'express';
import { getCountOfUniqueCustomers } from '../controllers/customerController.js';

const router = express.Router();

router.get("/customerCount",getCountOfUniqueCustomers)

export default router;