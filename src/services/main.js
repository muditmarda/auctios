const db = require("../models/index");
const Sequelize = require("sequelize");

async function getAuctions(userPubKey){
    const res = []
    if (!userPubKey) {
        const auctionDetails = await db.auctions.findAll();
        auctionDetails.forEach(element => {
            if (element.dataValues.participants){
                element.dataValues.participantCount = element.dataValues.participants.length;
            } else {
                element.dataValues.participantCount = 0;
            }
            res.push(element.dataValues);
        });
        return res;    
    }
    const auctionDetails = await db.auctions.findAll({
        where: Sequelize.or(
            { owner: userPubKey },
            { userPubKey: userPubKey }
        )        
    });
    // check validity of userPubKey
    if (auctionDetails.length === 0 ) {
        return res;
    }
    auctionDetails.forEach((element) => {
        const detail = {};
        detail.assetId = element.assetId;
        detail.assetName = element.assetName;
        detail.assetDescription = element.assetDescription;
        detail.auctionType = element.auctionType;
        detail.contractAddress = element.contractAddress;
        detail.seller = element.userPubKey;
        detail.buyer = element.owner;
        if (userPubKey === element.owner){
            detail.participatedAs = "bidder";
        } else if (userPubKey === element.userPubKey){
            detail.participatedAs = "auctioneer"
        }
        detail.auctionParams = element.auctionParams;
        detail.auctionStatus = element.auctionStatus;
        detail.participantCount = element.participants.length;
        detail.shortlisted = false;

        res.push(detail);
    });
    console.log({res})
    const bidDetails = await db.bids.findOne({
        where: {
            userPubKey
        }
    });
    if (!bidDetails) {
        return res;
    }
    bidDetails.shortlistedAuctionIds.forEach(async(element) => {
        const auctionDetails = await db.auctions.findOne({
            where: {
                assetId: element
            }
        });
        const detail = {};
        detail.assetId = auctionDetails.assetId;
        detail.assetName = auctionDetails.assetName;
        detail.assetDescription = auctionDetails.assetDescription;
        detail.auctionType = auctionDetails.auctionType;
        detail.contractAddress = auctionDetails.contractAddress;
        detail.seller = auctionDetails.userPubKey;
        detail.participatedAs = "bidder"
        detail.auctionParams = auctionDetails.auctionParams;
        detail.auctionStatus = auctionDetails.auctionStatus;
        detail.participantCount = auctionDetails.participants.length;
        detail.shortlisted = true;

        res.push(detail);
    });
    bidDetails.auctionId.array.forEach(element => {
        
    });
}

async function shortlistAuction(userPubKey, assetId){
    // make entry for userPubKey in bid table in shortlistedAuctionIds and add userPubKey 
    const bidDetails = await db.bids.findOrCreate({
        where: {
            userPubKey: userPubKey
        }
    })
    // bidDetails = [instance, created]
    if (bidDetails[1]) {
        const shortlistedAuctionIds = []
        shortlistedAuctionIds.push(assetId)
        await db.bids.update(
            {shortlistedAuctionIds},
            {where: {userPubKey}}
        )
    } else {
        let index = bidDetails[0].shortlistedAuctionIds.indexOf(assetId);
        if (index == -1){
            bidDetails[0].shortlistedAuctionIds.push(assetId);
            await db.bids.update(
                {shortlistedAuctionIds: bidDetails[0].shortlistedAuctionIds},
                {where: {userPubKey}}
            )
        } else {
            bidDetails[0].shortlistedAuctionIds.splice(index, 1)
            await db.bids.update(
                {shortlistedAuctionIds: bidDetails[0].shortlistedAuctionIds},
                {where: {userPubKey}}
            )
        }
    }
}

// Take image and store in file system?
async function updateAuctionDetails(userPubKey, assetId, assetDescription){

}
module.exports.getAuctions = getAuctions;
module.exports.shortlistAuction = shortlistAuction;
