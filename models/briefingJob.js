
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const BriefingJob = sequelize.define('BriefingJob', {
    id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false
    },

    referenceTime: {
        type: DataTypes.DATE,
        allowNull: false
    },

    status: {
        type: DataTypes.ENUM(
            'PENDING',
            'RUNNING',
            'COMPLETED',
            'FAILED'
        ),
        allowNull: false,
        defaultValue: 'PENDING'
    },

    candidates: {
        type: DataTypes.JSON,
        allowNull: true
    },

    attemptCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },

    lastErrorCode: {
        type: DataTypes.STRING(100),
        allowNull: true
    },

    lastError: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    nextRetryAt: {
        type: DataTypes.DATE,
        allowNull: true
    },

    startedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },

    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }

}, {
    tableName: 'briefing_jobs',
    timestamps: true,
    indexes: [
        {
            fields: ['status', 'nextRetryAt']
        }
    ]
});

module.exports = BriefingJob;
