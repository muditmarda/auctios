const dbConfig = require("../db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  timestamps: true,
  underscored: true,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.auctions = require("./auction.model.js")(sequelize, Sequelize);
db.bids = require("./bid.model.js")(sequelize, Sequelize);
db.contractHistories = require("./contractHistory.model.js")(sequelize, Sequelize);

module.exports = db;
