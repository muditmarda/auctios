const BetterCallApi = require("./util");
const db = require("../models/index");

const Sequelize = require("sequelize");

// Store in config
const auctionContractAddress = "KT1NG33RboNuw4KSQmFBZtY5ast5334o5zfh";

async function pollAuctionContract(){
    try {
    let contractHistory = await db.contractHistories.findOne({
        where: {contractAddress: auctionContractAddress}
    });

    // put this call in try catch 
    const resp = await BetterCallApi.getContractOperations(auctionContractAddress, contractHistory.dataValues.lastId);
    const new_ops = resp.operations.reverse();

    last_id = resp.last_id;
    // put for loop in try catch
    for (const new_op of new_ops) {
        // TODO: check all possible status
        if (new_op.status === 'failed' || new_op.status === "backtracked") {
            continue;
        }
        else if (new_op.status != 'applied') {
            // what to do
            console.log("=======================Bugg=======================");
            console.log(new_op, "\n\n\n");
            continue;
        }
        switch(new_op.entrypoint){
            case "configureAuction":
                const instanceStorageDetails = await BetterCallApi.getContractStorage(new_op.destination);
                // save to DB - auctions
                let assetName = "";
                let assetId = "";
                let auctionType = "";
                let startTime = "";
                let waitTime = "";
                let auctionParams = {}
                instanceStorageDetails.children.forEach((element) => {
                    switch(element.name){
                        // generic auction details
                        case "asset_id":
                            assetId = element.value;
                            break;
                        case "start_time":
                            startTime = element.value;
                            break;
                        case "wait_time":
                            waitTime = element.value;
                            break;
                        // English auction params
                        case "current_bid":
                            auctionParams.currentBid = element.value;
                            break;
                        case "min_increase":
                            auctionParams.minIncrease = element.value;
                            break;
                        case "highest_bidder":
                            auctionParams.highestBidder = element.value;
                            break;
                        // Dutch auction params
                        case "current_price":
                            auctionParams.currentPrice = element.value;
                            break;
                        case "reserve_price":
                            auctionParams.reservePrice = element.value;
                            break;
                        // Sealed bid auction params
                        case "participation_fee":
                            auctionParams.participationFee = element.value;
                            break;
                        case "highest_bid":
                            auctionParams.highestBid = element.value;
                            break;
                        case "highest_bidder":
                            auctionParams.highestBidder = element.value;
                            break;
                        default:
                            //
                    }
                });
                // If instance is reconfigured (i.e. the configureAuction entry_point has been called twice)
                // update auctionParams instead of creating
                const exists = await db.auctions.findOne({
                    where: {contractAddress: new_op.destination}
                });
                if(exists){
                    await db.auctions.update(
                        { auctionParams },
                        { where : {contractAddress: new_op.destination }}
                    );
                    continue;
                }

                const masterStorageDetails = await BetterCallApi.getContractStorage(auctionContractAddress);
                // 3rd element of masterStorageDetails.children is instance_map 
                // as storage data is stored and sent alphabetically 
                // therefore 1st -> dutch_factory, 2nd -> english_factory, 4th -> sealed_bid_factory, 5th ->vickrey_factory
                masterStorageDetails.children[3].children.forEach((assets) => {
                    if (assets.name == assetId){
                        assets.children.forEach((element) => {
                            switch(element.name){
                                case "asset_name":
                                    assetName = element.value;
                                    break;
                                case "auction_type":
                                    auctionType = element.value;
                                    break;
                                default:
                                    //
                            }
                        });
                    }                    
                });
                await db.auctions.create({
                    userPubKey: new_op.source,
                    assetId,
                    assetName,  
                    auctionType,
                    contractAddress: new_op.destination,
                    startTime,
                    waitTime,
                    auctionStatus: "upcoming",
                    owner: new_op.source,
                    auctionParams,
                });
                break;
            case "startAuction":
                // save to contractHistories table
                await db.contractHistories.create({
                    contractAddress: new_op.destination
                })
                // change status to ongoing
                await db.auctions.update(
                    { auctionStatus: "ongoing" },
                    { where : {contractAddress: new_op.destination }}
                )
                break;
            case "destroyInstance":
                // set status as completed in auctions table for contract_address == new_op.destination
                await db.auctions.update(
                    { auctionStatus: "completed" },
                    { where : {contractAddress: new_op.destination }}
                )
                // get participants from auctions table for contract_address == new_ops[i].destination
                // for each participant, clear this auction's id from their bid table entry (auctionIds array)
                const auctionDetails = db.auctions.findOne({
                    where: {contract_address: new_op.destination}
                })
                const participants = auctionDetails.participants;
                participants.forEach(async (participant) => {
                    const bidDetails = await db.bids.findOrCreate({
                        where: {
                            userPubKey: participant
                        }
                    })
                    let index = bidDetails.auctionIds.indexOf(auctionDetails.assetId);
                    bidDetails.auctionIds.splice(index, 1)
                    bidDetails.bids.splice(index, 1)
                    await db.bids.update(
                        {auctionIds: bidDetails.auctionIds, bids: bidDetails.bids},
                        {where: {userPubKey: participant}}
                    )                    
                });
                // delete entry from contractHistories
                await db.contractHistories.delete({
                    where: {contractAddress: new_op.destination}
                })
                break;
            case "transferOwnership":
                // change owner in auctions table for contract_address
                break;
            default:
                //
                break;
        }
    };
    await db.contractHistories.update(
        { lastId: last_id },
        { where: { contractAddress: auctionContractAddress } }
    );
    } catch(err){
        console.log({err})
    }

}

// Try catch
async function pollInstanceContracts(){
    // findAll from auctions from contractHistories where contractAddress != auctionContractAddress
    // poll till instance is destroyed and entry is deleted from contractHistories
    const liveAuctions = await db.contractHistories.findAll({
        where : {contractAddress : { [Sequelize.Op.not]: auctionContractAddress} }
    });
    for (const iterator of liveAuctions) {  
        const auctionDetails = await db.auctions.findOne({
            where: { contractAddress: iterator.dataValues.contractAddress}
        })
        const data = await BetterCallApi.getContractOperations(iterator.dataValues.contractAddress, iterator.dataValues.lastId);
        const new_ops = data.operations.reverse();
        last_id = data.last_id;
        for (const new_op of new_ops) {
            if (new_op.status === 'failed') {
                continue;
            }
            else if (new_op.status != 'applied') {
                // what to do
                console.log("=======================Bugg=======================");
                console.log(new_op, "\n\n\n");
                continue;
            }
            switch (auctionDetails.auctionType) {
                case "english":
                    // check for "bid" entrypoint
                    // store highest_bid and highest_bidder in auction_params JSON in auctions table
                    if (new_op.entrypoint === "bid"){
                        auctionDetails.auctionParams.highest_bidder = new_op.source;
                        auctionDetails.auctionParams.highest_bid = new_op.amount;
                        await db.auctions.update(
                            {auctionParams: auctionDetails.auctionParams, participants: new_op.source},
                            {where: {contractAddress: auctionDetails.contractAddress}}
                        )
                        // make entry for source account in bid table and add source account as participant in auctions table
                        const bidDetails = await db.bids.findOrCreate({
                            where: {
                                userPubKey: new_op.source
                            }
                        })
                        // bidDetails = [instance, created]
                        if (bidDetails[1]) {
                            const auctionIds = []
                            auctionIds.push(auctionDetails.assetId)
                            const bids = []
                            bids.push(new_op.amount)
                            await db.bids.update(
                                {auctionIds, bids},
                                {where: {userPubKey: new_op.source}}
                            )
                        } else {
                            let index = bidDetails[0].auctionIds.indexOf(auctionDetails.assetId);
                            if (index == -1){
                                bidDetails[0].auctionIds.push(auctionDetails.assetId);
                                bidDetails[0].bids.push(new_op.amount);
                                await db.bids.update(
                                    {auctionIds: bidDetails[0].auctionIds, bids: bidDetails[0].bids},
                                    {where: {userPubKey: new_op.source}}
                                )
                            } else {
                                bidDetails[0].bids[index] = new_op.amount;
                                await db.bids.update(
                                    {bids: bidDetails[0].bids},
                                    {where: {userPubKey: new_op.source}}
                                )
                            }
                        }
                    }
                    break;
                case "dutch":
                    // check for "dropPrice" entrypoint
                    // store current_price in auction_params JSON in auctions table
                    if (new_op.entrypoint === "dropPrice"){
                        auctionDetails.auctionParams.current_price = new_op.parameters.value;
                        await db.auctions.update(
                            {auctionParams: auctionDetails.auctionParams},
                            {where: {contractAddress: auctionDetails.contractAddress}}
                        )
                    }
                        break;
                case "sealed-bid":
                    // check for "submitSealedBid" entrypoint 
                    // add source account as participant in auctions table 
                    // check for "revealBid" entrypoint 
                    // after each call, check for highest_bid and highest_bidder in storage or in transaction storage_diff, 
                    // and update auction_params JSON in auctions table
                    break;
                case "vickrey":
                    //
                    break;
                default:
                    //
            }

        }
        await db.contractHistories.update(
            { lastId: last_id },
            { where: { contractAddress: iterator.dataValues.contractAddress } }
        );
    }

}

module.exports.pollAuctionContract = pollAuctionContract;
module.exports.pollInstanceContracts = pollInstanceContracts;