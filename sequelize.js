const { Sequelize } = require('sequelize')
// const Viewpoint = require('./viewpoint');
// const Analysis = require('./analysis');

let database = process.env.DB_DATABASE;
let user = process.env.DB_USER;
let password = process.env.DB_PASSWORD;
let host = process.env.DB_HOST;

const sequelize = new Sequelize(database, user, password, {
    host: host,
    dialect: 'mysql'
});
//
// // Define the relationships
// Viewpoint.hasMany(Analysis, { foreignKey: 'ref' });
// Analysis.belongsTo(Viewpoint, { foreignKey: 'ref' });

module.exports = sequelize;