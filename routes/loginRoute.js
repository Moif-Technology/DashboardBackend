import express from 'express';
import { login, logout, updatePassword } from '../controllers/loginController.js';



const router = express.Router();

router.post("/login",login);
router.post("/logout", logout);
router.post("/updatePassword", updatePassword);

export default router;