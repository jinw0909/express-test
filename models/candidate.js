const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Candidate = sequelize.define('Candidates', {
    articleId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    timestamps: true
})

module.exports = Candidate;