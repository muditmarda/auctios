module.exports = (sequelize, Sequelize) => {
  // TODO: Rename
  const ContractHistoryModel = sequelize.define("contractHistories", {
    contractAddress: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    lastId: {
      type: Sequelize.STRING,
      defaultValue: '',
    },
    createdAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updatedAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  return ContractHistoryModel;
};
