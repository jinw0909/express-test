const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Translation = sequelize.define('Translation', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        comment: '분석 ID. PK'
    },
    title : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목'
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약'
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
    imageUrl : {
        type:  DataTypes.STRING,
        allowNull: true,
        comment: '기사 이미지'
    },
    date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '기사 발행 시간'
    },
    title_jp : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 일본어 번역'
    },
    title_cn : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 중국어 간체자 번역'
    },
    title_tw : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 중국어 번체자 번역'
    },
    title_vn : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 베트남어 번역'
    },
    content_jp : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 일본어 번역'
    },
    content_cn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 중국어 간체자 번역'
    },
    content_tw : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 중국어 번체자 번역'
    },
    content_vn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 베트남어 번역'
    },
}, {
    tableName: 'news_en',  // Specify the table name as 'news_en'
    timestamps: true       // Enable automatic management of createdAt and updatedAt fields
});

module.exports = Translation;
