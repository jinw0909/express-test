const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Viewpoint = sequelize.define('Viewpoint', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    viewpoint: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_jp: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_cn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_tw: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    viewpoint_vn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
}, {
    tableName: 'viewpoints',  // Explicitly set the table name to 'viewpoints'
    timestamps: true          // Enable automatic timestamps management for createdAt and updatedAt
});

module.exports = Viewpoint;
