const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Translation = sequelize.define('Translation', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    //Define model attributes
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    title : {
        type: DataTypes.STRING,
        allowNull: true
    },
    title_jp : {
        type: DataTypes.STRING,
        allowNull: true
    },
    title_kr : {
        type: DataTypes.STRING,
        allowNull: true
    },
    title_vn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    title_cn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    summary_jp : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    summary_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    summary_vn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    summary_cn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    imageUrl : {
        type:  DataTypes.STRING,
        allowNull: true
    },
    publisher: {
        type: DataTypes.STRING,
        allowNull: true
    },
    analysis: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_jp : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_kr : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_vn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_cn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mp3 : {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_jp : {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_kr : {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_vn : {
        type: DataTypes.STRING,
        allowNull: true
    },
    mp3_cn : {
        type: DataTypes.STRING,
        allowNull: true
    },
    content : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content_kr : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content_vn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content_cn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
})

module.exports = Translation;