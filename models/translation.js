const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Translation = sequelize.define('Translation', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        comment: '분석 ID. PK'
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약'
    },
    date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '기사 발행 시간'
    },
    imageUrl : {
        type:  DataTypes.STRING,
        allowNull: true,
        comment: '기사 이미지'
    },
    analysis: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 분석'
    },
    content : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문'
    },
    tableName: 'news_en',  // Specify the table name as 'news_en'
    timestamps: true       // Enable automatic management of createdAt and updatedAt fields
});

module.exports = Translation;
