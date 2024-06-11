const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const BitcoinAnalysis = sequelize.define('BitcoinAnalysis', {
    requestTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    day: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    day_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    day_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    day_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    day_cn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    week: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    week_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    week_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    week_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    week_cn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    month: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    month_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    month_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    month_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    month_cn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    prediction: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    prediction_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    prediction_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    prediction_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    prediction_cn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mp3 : {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_jp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_kr: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_vn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_cn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    daychart_imgUrl : {
        type: DataTypes.STRING,
        allowNull: true
    },
    weekchart_imgUrl : {
        type: DataTypes.STRING,
        allowNull: true
    },
    monthchart_imgUrl : {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'Bitcoin_Analysis',
    timestamps: false
});

module.exports = BitcoinAnalysis;