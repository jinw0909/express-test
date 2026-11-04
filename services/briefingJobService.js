
const { Op } = require('sequelize');
const { DateTime } = require('luxon');
const { BriefingJob } = require('../models');
const { performArticleAnalysis } = require('../routes/create');
const {isQuotaError} = require("./openaiRetry");

const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 12;

function getBriefingSchedule(now = new Date()) {
    const kst = DateTime.fromJSDate(now, {
        zone: 'Asia/Seoul'
    });

    const morning = kst.set({
        hour: 8, minute: 30, second: 0, millisecond: 0
    });

    const evening = kst.set({
        hour: 20, minute: 30, second: 0, millisecond: 0
    });

    const referenceTime =
        kst >= evening ? evening
            : kst >= morning ? morning
                : morning.minus({ days: 1 }).set({
                    hour: 20
                });

    const period = referenceTime.hour === 8 ? 'AM' : 'PM';

    return {
        id: `${referenceTime.toFormat('yyyyLLdd')}_${period}`,
        referenceTime: referenceTime.toJSDate()
    };
}
async function createScheduledBriefing(schedule) {
    const [job] = await BriefingJob.findOrCreate({
        where: { id: schedule.id },
        defaults: {
            id: schedule.id,
            referenceTime: schedule.referenceTime,
            status: 'PENDING',
            attemptCount: 0
        }
    });

    return job;
}

async function executeBriefingJob(jobId) {
    const now = new Date();

    // 조건부 UPDATE를 사용해 동시에 실행되는 작업을 방지
    const [claimed] = await BriefingJob.update(
        {
            status: 'RUNNING',
            startedAt: now,
            attemptCount: require('sequelize').literal(
                'attemptCount + 1'
            ),
            nextRetryAt: null
        },
        {
            where: {
                id: jobId,
                attemptCount: {
                    [Op.lt]: MAX_JOB_ATTEMPTS
                },
                [Op.or]: [
                    { status: 'PENDING' },
                    {
                        status: 'FAILED',
                        lastErrorCode: {
                            [Op.in]: [
                                'insufficient_quota',
                                'credit_balance_exhausted'
                            ]
                        },
                        nextRetryAt: {
                            [Op.lte]: now
                        }
                    }
                ]
            }
        }
    );

    if (claimed !== 1) {
        console.log(`[${jobId}] Already running, completed or not due`);
        return { jobId, skipped: true };
    }

    const job = await BriefingJob.findByPk(jobId);

    try {
        const result = await performArticleAnalysis({
            briefingId: job.id,
            referenceTime: job.referenceTime,
            savedCandidates: job.candidates,
            onCandidatesSelected: async (candidates) => {
                await BriefingJob.update(
                    { candidates },
                    {
                        where: {
                            id: job.id,
                            status: 'RUNNING'
                        }
                    }
                );
            }
        });

        await BriefingJob.update(
            {
                status: 'COMPLETED',
                completedAt: new Date(),
                nextRetryAt: null,
                lastError: null,
                lastErrorCode: null
            },
            {
                where: {
                    id: job.id,
                    status: 'RUNNING'
                }
            }
        );

        console.log(`[${job.id}] COMPLETED`);
        return result;

    } catch (error) {
        const shouldRetry =
            isQuotaError(error) &&
            job.attemptCount < MAX_JOB_ATTEMPTS;

        const nextRetryAt = shouldRetry
            ? new Date(Date.now() + RETRY_DELAY_MS)
            : null;

        await BriefingJob.update(
            {
                status: 'FAILED',
                lastErrorCode:
                    String(error?.code ?? 'UNKNOWN').slice(0, 100),
                lastError:
                    String(error?.stack ?? error?.message ?? error)
                        .slice(0, 16000),
                nextRetryAt
            },
            {
                where: {
                    id: job.id,
                    status: 'RUNNING'
                }
            }
        );

        console.error(
            `[${job.id}] FAILED`,
            error?.code,
            nextRetryAt
        );

        throw error;
    }
}

async function startScheduledBriefing(now = new Date()) {
    const schedule = getBriefingSchedule(now);
    const job = await createScheduledBriefing(schedule);

    return executeBriefingJob(job.id);
}

async function retryFailedBriefings() {
    const now = new Date();

    const jobs = await BriefingJob.findAll({
        where: {
            status: 'FAILED',
            lastErrorCode: {
                [Op.in]: [
                    'insufficient_quota',
                    'credit_balance_exhausted'
                ]
            },
            attemptCount: {
                [Op.lt]: MAX_JOB_ATTEMPTS
            },
            nextRetryAt: {
                [Op.lte]: now
            }
        },
        order: [['nextRetryAt', 'ASC']],
        limit: 10
    });

    for (const job of jobs) {
        try {
            await executeBriefingJob(job.id);
        } catch (error) {
            console.error(
                `[${job.id}] Retry failed:`,
                error.message
            );
        }
    }
}

module.exports = {
    getBriefingSchedule,
    getBriefingScheduleByDate,
    createScheduledBriefing,
    executeBriefingJob,
    startScheduledBriefing,
    startManualBriefing,  // 추가
    retryFailedBriefings
};


function getBriefingScheduleByDate(targetDate, period) {
    if (
        typeof targetDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    ) {
        throw new Error('Invalid date format');
    }

    if (!['AM', 'PM'].includes(period)) {
        throw new Error('Invalid period');
    }

    const referenceTime = DateTime.fromISO(targetDate, {
        zone: 'Asia/Seoul'
    }).set({
        hour: period === 'AM' ? 8 : 20,
        minute: 30,
        second: 0,
        millisecond: 0
    });

    if (
        !referenceTime.isValid ||
        referenceTime.toFormat('yyyy-MM-dd') !== targetDate
    ) {
        throw new Error('Invalid target date');
    }

    if (referenceTime.toJSDate() > new Date()) {
        throw new Error('미래 시점의 브리핑은 생성할 수 없습니다.');
    }

    return {
        id: `${referenceTime.toFormat('yyyyLLdd')}_${period}`,
        referenceTime: referenceTime.toJSDate()
    };
}

async function startManualBriefing(targetDate, period) {
    const schedule = getBriefingScheduleByDate(targetDate, period);
    const job = await createScheduledBriefing(schedule);

    return executeBriefingJob(job.id, { manual: true });
}