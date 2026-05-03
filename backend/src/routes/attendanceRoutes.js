import express from 'express';
import attendanceController from '../controllers/attendanceController.js';
import {
	attendanceApiKeyAuth,
	attendanceCorsGuard,
	attendanceRateLimit,
	validateAttendancePayload,
} from '../middlewares/attendanceSecurityMiddleware.js';

const router = express.Router();

router.post(
	'/',
	attendanceCorsGuard,
	attendanceRateLimit,
	attendanceApiKeyAuth,
	validateAttendancePayload,
	attendanceController.create
);

export default router;
