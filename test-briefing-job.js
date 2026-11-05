
require('dotenv').config();

const assert = require('node:assert/strict');
const sequelize = require('./sequelize');
const { BriefingJob } = require('./models');

// 서비스가 import하기 전에 실제 분석 함수를 가짜로 교체
const createModule = require('./routes/create');
const originalAnalysis = createModule.performArticleAnalysis;

let mockAnalysis = async () => ({ ok: true });

createModule.performArticleAnalysis = async (params) => {
    return mockAnalysis(params);
};

const {
    executeBriefingJob
} = require('./services/briefingJobService');

const testIds = [];

async function newTestJob(suffix) {
    const id = `T${Date.now()}${suffix}`;

    testIds.push(id);

    await BriefingJob.create({
        id,
        referenceTime: new Date(),
        status: 'PENDING',
        attemptCount: 0
    });

    return id;
}

function quotaError() {
    const error = new Error('Insufficient quota');
    error.status = 429;
    error.code = 'insufficient_quota';
    return error;
}

async function main() {
    await sequelize.authenticate();

    // 1. 정상 완료
    const successId = await newTestJob('A');

    mockAnalysis = async () => ({ ok: true });

    await executeBriefingJob(successId);

    let job = await BriefingJob.findByPk(successId);

    assert.equal(job.status, 'COMPLETED');
    assert.equal(job.attemptCount, 1);

    console.log('PASS: 정상 완료');

    // 2. COMPLETED 중복 실행 방지
    const skipped = await executeBriefingJob(successId);

    assert.equal(skipped.skipped, true);

    job = await BriefingJob.findByPk(successId);
    assert.equal(job.attemptCount, 1);

    console.log('PASS: 중복 실행 방지');

    // 3. 요금 부족 시 재실행 예약
    const quotaId = await newTestJob('B');

    mockAnalysis = async () => {
        throw quotaError();
    };

    await assert.rejects(
        executeBriefingJob(quotaId),
        { code: 'insufficient_quota' }
    );

    job = await BriefingJob.findByPk(quotaId);

    assert.equal(job.status, 'FAILED');
    assert.equal(job.lastErrorCode, 'insufficient_quota');
    assert.ok(job.nextRetryAt);

    console.log('PASS: 요금 부족 재실행 예약');

    // 4. 재실행 시 정상 완료
    await job.update({
        nextRetryAt: new Date(Date.now() - 1000)
    });

    mockAnalysis = async () => ({ ok: true });

    await executeBriefingJob(quotaId);

    job = await BriefingJob.findByPk(quotaId);

    assert.equal(job.status, 'COMPLETED');
    assert.equal(job.attemptCount, 2);
    assert.equal(job.nextRetryAt, null);

    console.log('PASS: 요금 부족 재실행 후 완료');

    // 5. 일반 오류는 재실행하지 않음
    const failedId = await newTestJob('C');

    mockAnalysis = async () => {
        const error = new Error('Invalid response');
        error.code = 'INVALID_RESPONSE';
        throw error;
    };

    await assert.rejects(
        executeBriefingJob(failedId),
        { code: 'INVALID_RESPONSE' }
    );

    job = await BriefingJob.findByPk(failedId);

    assert.equal(job.status, 'FAILED');
    assert.equal(job.nextRetryAt, null);

    const noRetry = await executeBriefingJob(failedId);

    assert.equal(noRetry.skipped, true);

    console.log('PASS: 일반 오류 재실행 차단');
    console.log('ALL TESTS PASSED');
}

main()
    .catch(error => {
        console.error('TEST FAILED:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        createModule.performArticleAnalysis = originalAnalysis;

        // 테스트 데이터 정리
        await BriefingJob.destroy({
            where: { id: testIds }
        });

        await sequelize.close();
    });
