const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Dominance = sequelize.define('Dominance', {
    dominance: {
        type: DataTypes.JSON,
        allowNull: false
    }
}, {
    timestamps: true // This will add the `createdAt` and `updatedAt` fields automatically
});

module.exports = Dominance;