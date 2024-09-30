const { Sequelize } = require('sequelize')

let database = process.env.DB_DATABASE;
let user = process.env.DB_USER;
let password = process.env.DB_PASSWORD;
let host = process.env.DB_HOST;

const sequelize = new Sequelize(database, user, password, {
    host: host,
    dialect: 'mysql',
    // logging: console.log
    logging: false
});

module.exports = sequelize;