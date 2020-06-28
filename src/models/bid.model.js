module.exports = (sequelize, Sequelize) => {
  const BidModel = sequelize.define('bids', {
    userPubKey: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    participatedAuctionIds: {
      type: Sequelize.TEXT,
      defaultValue: '',
      get() {
        if (this.getDataValue('participatedAuctionIds')) {
          return this.getDataValue('participatedAuctionIds').split(';');
        } else {
          return [];
        }
      },
      set(val) {
        this.setDataValue('participatedAuctionIds', val.join(';'));
      },
    },
    bids: {
      type: Sequelize.TEXT,
      defaultValue: '',
      get() {
        if (this.getDataValue('bids')) {
          return this.getDataValue('bids').split(';');
        } else {
          return [];
        }
      },
      set(val) {
        this.setDataValue('bids', val.join(';'));
      },
    },
    shortlistedAuctionIds: {
      type: Sequelize.TEXT,
      defaultValue: '',
      get() {
        if (this.getDataValue('shortlistedAuctionIds')) {
          return this.getDataValue('shortlistedAuctionIds').split(';');
        } else {
          return [];
        }
      },
      set(val) {
        this.setDataValue('shortlistedAuctionIds', val.join(';'));
      },
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

  return BidModel;
};
