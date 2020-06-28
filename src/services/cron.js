const TezosApi = require('../utils/tezos');
const db = require('../models/index');

const Sequelize = require('sequelize');

const config = require('../config.js');
const auctionContractAddress = config.auctionContractAddress;

// TODO: put stuff propery in try catch
async function pollAuctionContract() {
  try {
    const contractHistory = await db.contractLastIds.findOne({
      where: { contractAddress: auctionContractAddress },
    });
    let lastId;
    if (!contractHistory) {
      await db.contractLastIds.create({
        contractAddress: auctionContractAddress,
      });
      lastId = '';
    } else {
      lastId = contractHistory.lastId;
    }

    const resp = await TezosApi.getContractOperations(
      auctionContractAddress,
      lastId,
    );
    const new_ops = resp.operations.reverse();
    last_id = resp.last_id;

    for (const new_op of new_ops) {
      // TODO: check all possible status
      if (new_op.status === 'failed' || new_op.status === 'backtracked') {
        continue;
      } else if (new_op.status != 'applied') {
        // what to do
        console.log('\n\n=======================Bugg=======================');
        console.log({ new_op });
        continue;
      }
      switch (new_op.entrypoint) {
        case 'configureAuction':
          const instanceStorageDetails = await TezosApi.getContractStorage(
            new_op.destination,
          );
          // save to auctions table
          let assetName = '';
          let assetDescription = '';
          let assetImageFileName = '';
          let assetId = '';
          let auctionType = '';
          let startTime = '';
          let roundTime = '';
          let auctionParams = {};
          instanceStorageDetails.children.forEach((element) => {
            switch (element.name) {
              // generic auction details
              case 'asset_id':
                assetId = element.value;
                break;
              case 'start_time':
                startTime = element.value;
                break;
              case 'round_time':
                roundTime = element.value;
                break;
              // English auction params
              case 'current_bid':
                auctionParams.currentBid = element.value;
                break;
              case 'min_increase':
                auctionParams.minIncrease = element.value;
                break;
              case 'highest_bidder':
                auctionParams.highestBidder = element.value;
                break;
              // Dutch auction params
              case 'current_price':
                auctionParams.currentPrice = element.value;
                break;
              case 'reserve_price':
                auctionParams.reservePrice = element.value;
                break;
              // Sealed bid auction params
              case 'participation_fee':
                auctionParams.participationFee = element.value;
                break;
              case 'highest_bid':
                auctionParams.highestBid = element.value;
                break;
              case 'highest_bidder':
                auctionParams.highestBidder = element.value;
                break;
              default:
              //
            }
          });
          // If instance is reconfigured (i.e. the configureAuction entry_point has been called twice)
          // update auctionParams instead of creating
          const exists = await db.auctions.findOne({
            where: { contractAddress: new_op.destination },
          });
          if (exists) {
            await db.auctions.update(
              { auctionParams },
              { where: { contractAddress: new_op.destination } },
            );
            continue;
          }

          const masterStorageDetails = await TezosApi.getContractStorage(
            auctionContractAddress,
          );
          // 3rd element of masterStorageDetails.children is instance_map
          // as storage data is stored and sent alphabetically
          // therefore 1st -> dutch_factory, 2nd -> english_factory, 4th -> sealed_bid_factory, 5th ->vickrey_factory
          masterStorageDetails.children[3].children.forEach((assets) => {
            if (assets.name == assetId) {
              assets.children.forEach((element) => {
                switch (element.name) {
                  case 'asset_name':
                    assetName = element.value;
                    break;
                  case 'auction_type':
                    auctionType = element.value;
                    break;
                  default:
                  //
                }
              });
            }
          });
          const assetDetails = await db.assetDetails.findOne({
            where: { contractAddress: new_op.destination },
          });
          if (assetDetails) {
            assetDescription = assetDetails.assetDescription;
            assetImageFileName = assetDetails.assetImageFileName;
          }
          await db.auctions.create({
            seller: new_op.source,
            assetId,
            assetName,
            assetDescription,
            assetImageFileName,
            auctionType,
            contractAddress: new_op.destination,
            startTime,
            roundTime,
            auctionStatus: 'upcoming',
            buyer: new_op.source,
            auctionParams,
          });
          break;
        case 'startAuction':
          // save to contractLastIds table
          await db.contractLastIds.create({
            contractAddress: new_op.destination,
          });
          // change status to ongoing
          await db.auctions.update(
            { auctionStatus: 'ongoing' },
            { where: { contractAddress: new_op.destination } },
          );
          await pollInstanceContract(new_op.destination, '');
          break;
        case 'destroyInstance':
          // set status as completed in auctions table
          await db.auctions.update(
            { auctionStatus: 'completed' },
            { where: { contractAddress: new_op.source } },
          );
          // get participants from auctions table for contract_address
          // for each participant, clear this auction's id from their bid table entry (participatedAuctionIds array)
          const auctionDetails = db.auctions.findOne({
            where: { contractAddress: new_op.source },
          });
          const participants = auctionDetails.participants;
          if (participants) {
            participants.forEach(async (participant) => {
              const bidDetails = await db.bids.findOrCreate({
                where: {
                  seller: participant,
                },
              });
              let index = bidDetails.participatedAuctionIds.indexOf(
                auctionDetails.assetId,
              );
              bidDetails.participatedAuctionIds.splice(index, 1);
              bidDetails.bids.splice(index, 1);
              await db.bids.update(
                {
                  participatedAuctionIds: bidDetails.participatedAuctionIds,
                  bids: bidDetails.bids,
                },
                { where: { seller: participant } },
              );
            });
          }
          // delete entry from contractLastIds
          await db.contractLastIds.destroy({
            where: { contractAddress: new_op.source },
          });
          break;
        case 'transferOwnership':
          // change owner in auctions table for contract_address
          // store transaction hash of this operation in contractAddress
          break;
        default:
          //
          break;
      }
    }
    await db.contractLastIds.update(
      { lastId: last_id },
      { where: { contractAddress: auctionContractAddress } },
    );
  } catch (err) {
    console.log({ err });
  }
}

async function pollAllInstanceContracts() {
  // findAll from auctions from contractLastIds where contractAddress != auctionContractAddress
  // poll till instance is destroyed and entry is deleted from contractLastIds
  const liveAuctions = await db.contractLastIds.findAll({
    where: { contractAddress: { [Sequelize.Op.not]: auctionContractAddress } },
  });
  for (const iterator of liveAuctions) {
    await pollInstanceContract(
      iterator.dataValues.contractAddress,
      iterator.dataValues.lastId,
    );
  }
}

// TODO: put stuff propery in try catch
async function pollInstanceContract(contractAddress, lastId) {
  try {
    const auctionDetails = await db.auctions.findOne({
      where: { contractAddress: contractAddress },
    });
    const data = await TezosApi.getContractOperations(contractAddress, lastId);
    const new_ops = data.operations.reverse();
    last_id = data.last_id;
    for (const new_op of new_ops) {
      if (new_op.status === 'failed') {
        continue;
      } else if (new_op.status != 'applied') {
        // what to do
        console.log('\n\n=======================Bugg=======================');
        console.log({ new_op });
        continue;
      }
      switch (auctionDetails.auctionType) {
        case 'english':
          // check for "bid" entrypoint
          // store highest_bid and highest_bidder in auction_params JSON in auctions table
          if (new_op.entrypoint === 'bid') {
            auctionDetails.auctionParams.highest_bidder = new_op.source;
            auctionDetails.auctionParams.highest_bid = new_op.amount;
            await db.auctions.update(
              {
                auctionParams: auctionDetails.auctionParams,
                participants: new_op.source,
              },
              { where: { contractAddress: auctionDetails.contractAddress } },
            );
            // make entry for source account in bid table and add source account as participant in auctions table
            const bidDetails = await db.bids.findOrCreate({
              where: {
                seller: new_op.source,
              },
            });
            // bidDetails = [instance, created]
            if (bidDetails[1]) {
              const participatedAuctionIds = [];
              participatedAuctionIds.push(auctionDetails.assetId);
              const bids = [];
              bids.push(new_op.amount);
              await db.bids.update(
                { participatedAuctionIds, bids },
                { where: { seller: new_op.source } },
              );
            } else {
              let index = bidDetails[0].participatedAuctionIds.indexOf(
                auctionDetails.assetId,
              );
              if (index == -1) {
                bidDetails[0].participatedAuctionIds.push(
                  auctionDetails.assetId,
                );
                bidDetails[0].bids.push(new_op.amount);
                await db.bids.update(
                  {
                    participatedAuctionIds:
                      bidDetails[0].participatedAuctionIds,
                    bids: bidDetails[0].bids,
                  },
                  { where: { seller: new_op.source } },
                );
              } else {
                bidDetails[0].bids[index] = new_op.amount;
                await db.bids.update(
                  { bids: bidDetails[0].bids },
                  { where: { seller: new_op.source } },
                );
              }
            }
          }
          break;
        case 'dutch':
          // check for "dropPrice" entrypoint
          // store current_price in auction_params JSON in auctions table
          if (new_op.entrypoint === 'dropPrice') {
            auctionDetails.auctionParams.current_price =
              new_op.parameters.value;
            await db.auctions.update(
              { auctionParams: auctionDetails.auctionParams },
              { where: { contractAddress: auctionDetails.contractAddress } },
            );
          }
          break;
        case 'sealed-bid':
          // check for "submitSealedBid" entrypoint
          // add source account as participant in auctions table
          // check for "revealBid" entrypoint
          // after each call, check for highest_bid and highest_bidder in storage or in transaction storage_diff,
          // and update auction_params JSON in auctions table
          break;
        case 'vickrey':
          //
          break;
        default:
        //
      }
    }
    await db.contractLastIds.update(
      { lastId: last_id },
      { where: { contractAddress: contractAddress } },
    );
  } catch (err) {
    console.log({ err });
  }
}

module.exports.pollAuctionContract = pollAuctionContract;
module.exports.pollInstanceContracts = pollAllInstanceContracts;
