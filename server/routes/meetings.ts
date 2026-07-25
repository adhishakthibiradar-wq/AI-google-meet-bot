import { Router } from 'express';
import { meetingController } from '../controllers/meetingController.js';

const router = Router();

// REST API Endpoints required:
// POST /api/meetings/join
router.post('/join', (req, res) => meetingController.joinMeeting(req, res));

// POST /api/meetings/stop
router.post('/stop', (req, res) => meetingController.stopMeeting(req, res));

// GET /api/meetings/status
router.get('/status', (req, res) => meetingController.getBotStatus(req, res));

// GET /api/meetings
router.get('/', (req, res) => meetingController.getAllMeetings(req, res));

// GET /api/meetings/:id
router.get('/:id', (req, res) => meetingController.getMeetingById(req, res));

// DELETE /api/meetings/:id
router.delete('/:id', (req, res) => meetingController.deleteMeeting(req, res));

// Additional utility routes
router.post('/upload-audio', (req, res) => meetingController.uploadAudio(req, res));
router.post('/:id/analyze', (req, res) => meetingController.reanalyzeMeeting(req, res));

export default router;
