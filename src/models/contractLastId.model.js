module.exports = (sequelize, Sequelize) => {
  const ContractLastIdModel = sequelize.define('contractLastIds', {
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

  return ContractLastIdModel;
};
