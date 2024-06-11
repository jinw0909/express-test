const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const DominanceAnalysis = sequelize.define('DominanceAnalysis', {
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    analysis: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    analysis_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_cn: {
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
    dominance_imgUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    goya_imgUrl : {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'Dominance_Analysis',
    timestamps: false
});

module.exports = DominanceAnalysis;