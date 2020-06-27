module.exports = (sequelize, Sequelize) => {
  // TODO: Rename
  const BidModel = sequelize.define("bids", {
    userPubKey: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    // TODO: Change to participatedAuctionIds
    auctionIds: {
      type: Sequelize.TEXT,
      defaultValue: "",
      get() {
        if (this.getDataValue('auctionIds')){
          return this.getDataValue('auctionIds').split(';');
        } else {
          return [];
        }
      },
      set(val) {
       this.setDataValue('auctionIds', val.join(';'));
      },
    },
    bids: {
      type: Sequelize.TEXT,
      defaultValue: "",
      get() {
        if (this.getDataValue('bids')){
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
      defaultValue: "",
      get() {
        if (this.getDataValue('shortlistedAuctionIds')){
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
