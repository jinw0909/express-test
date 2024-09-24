const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Blockmedia = sequelize.define('Blockmedia', {
    id : {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        primaryKey: true
    },
    title : {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    imageUrl : {
        type: DataTypes.STRING,
        allowNull: true
    },
    publisher: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: true //Enable automatic timestamps management
});

module.exports = Blockmedia;