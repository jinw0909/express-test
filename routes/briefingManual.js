const express = require('express');
const router = express.Router();

const {
    startManualBriefing
} = require('../services/briefingJobService');

router.post('/complete', async (req, res) => {
    try {
        const { date, period } = req.body;

        if (!date || !period) {
            return res.status(400).json({
                ok: false,
                error: 'date and period are required'
            });
        }

        const result = await startManualBriefing(date, period);

        if (result.skipped) {
            return res.status(409).json({
                ok: false,
                message: 'Briefing is already running or completed',
                jobId: result.jobId
            });
        }

        return res.json({
            ok: true,
            result
        });
    } catch (error) {
        console.error('Manual briefing failed:', error);

        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

module.exports = router;