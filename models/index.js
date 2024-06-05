// models/index.js
const Sequelize = require('sequelize');
const sequelize = require('../sequelize');

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.Viewpoint = require('./viewpoint');
db.Analysis = require('./analysis');
db.Coinness = require('./coinness');
db.Blockmedia = require('./blockmedia');
db.BitcoinAnalysis = require('./bitcoinAnalysis');
db.BitcoinPrice = require('./bitcoinPrice');
db.Candidate = require('./candidate');
db.Translation = require('./translation');
db.Dominance = require('./dominance');
// Define the relationships
db.Viewpoint.hasMany(db.Analysis, { foreignKey: 'ref' });
db.Analysis.belongsTo(db.Viewpoint, { foreignKey: 'ref' });
// db.BitcoinAnalysis.hasMany(db.BitcoinPrice, { foreignKey: 'ref'});
// db.BitcoinPrice.belongsTo(db.BitcoinAnalysis, { foreignKey: 'ref' });
module.exports = db;
