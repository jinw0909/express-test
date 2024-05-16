const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Viewpoint = sequelize.define('Viewpoint', {
    id : {
        type: DataTypes.STRING,
        primaryKey: true
    },
    //Define model attributes
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    viewpoint : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_jp : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_kr : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_vn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_cn : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mp3: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    mp3_jp : {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mp3_kr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mp3_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mp3_cn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    imageUrl : {
        type:  DataTypes.STRING,
        allowNull: true
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
})

module.exports = Viewpoint;