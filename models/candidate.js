const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Candidate = sequelize.define('Candidates', {
    //Define model attributes
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
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
})

module.exports = Candidate;