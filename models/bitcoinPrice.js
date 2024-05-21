const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const BitcoinPrice = sequelize.define('BitcoinPrice', {
    requestTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    period: {
        type: DataTypes.STRING,
        allowNull: false
    },
    score: {
        type: DataTypes.JSON,
        allowNull: false
    },
    price: {
        type: DataTypes.JSON,
        allowNull: false
    },
}, {
    tableName: 'Bitcoin_Price',
    timestamps: false
});

module.exports = BitcoinPrice;