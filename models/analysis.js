const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Analysis = sequelize.define('Analysis', {
    id : {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    //Define model attributes
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    analysis: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    ref: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: 'viewpoints', // This is the table name of Viewpoint
            key: 'id'
        }
    }
}, {
    timestamps: true
})

module.exports = Analysis;
