// models/index.js
const Sequelize = require('sequelize');
const sequelize = require('../sequelize');

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.Viewpoint = require('./viewpoint');
db.Analysis = require('./analysis');
db.Blockmedia = require('./blockmedia');
db.Candidate = require('./candidate');
db.Translation = require('./translation');

// Define the relationships
db.Viewpoint.hasMany(db.Analysis, { foreignKey: 'ref' });
db.Analysis.belongsTo(db.Viewpoint, { foreignKey: 'ref' });

module.exports = db;
