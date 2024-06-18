const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Translation = sequelize.define('Translation', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        comment: '분석 ID. PK'
    },
    //Define model attributes
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '분석이 생성된 시간'
    },
    title : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목'
    },
    title_jp : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 (일본어)'
    },
    title_kr : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 (한국어)'
    },
    title_vn: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 (베트남어)'
    },
    title_cn: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '분석한 기사의 제목 (중국어)'
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약'
    },
    summary_jp : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약 (일본어)'
    },
    summary_kr: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약 (한국어)'
    },
    summary_vn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약 (베트남어)'
    },
    summary_cn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 내용 요약 (중국어)'
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
    publisher: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '기사 발행 기관'
    },
    analysis: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 분석'
    },
    analysis_jp : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 분석 (일본어)'
    },
    analysis_kr : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 분석 (한국어)'
    },
    analysis_vn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 분석 (베트남어)'
    },
    analysis_cn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 분석 (중국어)'
    },
    mp3 : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '브리핑 음성'
    },
    mp3_jp : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '브리핑 음성 (일본어)'
    },
    mp3_kr : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '브리핑 음성 (한국어)'
    },
    mp3_vn : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '브리핑 음성 (베트남어)'
    },
    mp3_cn : {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '브리핑 음성 (중국어)'
    },
    content : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문'
    },
    content_jp: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 (일본어)'
    },
    content_kr : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 (한국어)'
    },
    content_vn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 (베트남어)'
    },
    content_cn : {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '기사 본문 (중국어)'
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '업데이트된 시간'
    }
})

module.exports = Translation;