
const express = require('express');
const router = express.Router();

const { BriefingJob } = require('../models');

// GET /api/briefing-jobs?limit=20
router.get('/', async (req, res) => {
    try {
        const parsedLimit = Number(req.query.limit ?? 20);

        if (
            !Number.isInteger(parsedLimit) ||
            parsedLimit < 1 ||
            parsedLimit > 100
        ) {
            return res.status(400).json({
                message: 'limit must be between 1 and 100'
            });
        }

        const jobs = await BriefingJob.findAll({
            attributes: [
                'id',
                'referenceTime',
                'status',
                'attemptCount',
                'lastErrorCode',
                'lastError',
                'nextRetryAt',
                'startedAt',
                'completedAt',
                'createdAt'
            ],
            order: [['referenceTime', 'DESC']],
            limit: parsedLimit,
            raw: true
        });

        return res.status(200).json({
            count: jobs.length,
            jobs
        });

    } catch (error) {
        console.error('Error fetching briefing jobs:', error);

        return res.status(500).json({
            message: 'Failed to fetch briefing jobs'
        });
    }
});

module.exports = router;
