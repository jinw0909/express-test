// const { DataTypes } = require('sequelize');
// const sequelize = require('../sequelize');
//
// const Analysis = sequelize.define('Analysis', {
//     id : {
//         type: DataTypes.INTEGER,
//         primaryKey: true
//     },
//     //Define model attributes
//     createdAt: {
//         type: DataTypes.DATE,
//         allowNull: false
//     },
//     summary: {
//         type: DataTypes.TEXT,
//         allowNull: false
//     },
//     date: {
//         type: DataTypes.STRING,
//         allowNull: true
//     },
//     imageUrl : {
//         type:  DataTypes.STRING,
//         allowNull: true
//     },
//     publisher: {
//         type: DataTypes.STRING,
//         allowNull: true
//     },
//     analysis: {
//         type: DataTypes.TEXT,
//         allowNull: false
//     },
//     updatedAt: {
//         type: DataTypes.DATE,
//         allowNull: false
//     },
//     ref: {
//         type: DataTypes.STRING,
//         allowNull: true,
//         references: {
//             model: 'Viewpoints', // This is the table name of Viewpoint
//             key: 'id'
//         }
//     }
// })
//
// module.exports = Analysis;


const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Analysis = sequelize.define('Analysis', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    // Define model attributes
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    publisher: {
        type: DataTypes.STRING,
        allowNull: true
    },
    analysis: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    ref: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: 'Viewpoints', // This is the table name of Viewpoint
            key: 'id'
        }
    }
}, {
    tableName: 'news_en', // Explicitly set the table name
    timestamps: true      // Enable createdAt and updatedAt by default
});

module.exports = Analysis;
