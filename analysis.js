const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Analysis = sequelize.define('Analysis', {
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
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    summary_jp : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    summary_kr: {
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
        allowNull: false
    },
    analysis_jp : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    analysis_kr : {
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
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    ref: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: 'Viewpoints', // This is the table name of Viewpoint
            key: 'id'
        }
    }
})

module.exports = Analysis;