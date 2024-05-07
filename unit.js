const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Unit = sequelize.define('Unit', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    //Define model attributes
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    title : {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    time: {
        type: DataTypes.STRING,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
})

module.exports = Unit;