const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Coinness = sequelize.define('Coinness', {
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
        allowNull: false
    },
    content: {
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

module.exports = Coinness;