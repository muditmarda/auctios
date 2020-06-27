const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

var corsOptions = {
  origin: "*"
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./models");
db.sequelize.sync();

const main = require("./services/main");

app.post('/shortlist-auction', (req, res) => {
});

app.post('/update-auction-details', (req, res) => {
});

app.get('/auctions', async (req, res) => {
  if (!Object.keys(req.query).length) {
    // send all auctions
    const resp = await main.getAuctions();
    return res.status(200).send(resp);
    }
  else if (Object.keys(req.query).length === 1 && req.query.user_pub_key) {
    // send auctions for user_pub_key
    const resp = await main.getAuctions(req.query.user_pub_key);
    return res.status(200).send(resp);
  } else {
    // send all auctions or error ?
    return res.status(400).send();
  }
});

app.get('/configure', async(req, res) => {
  const exists = db.contractHistories.findOne({
    // TODO: store master auction contract address in config and fetch from there 
    where: {contractAddress: "KT1NG33RboNuw4KSQmFBZtY5ast5334o5zfh"}
  })
  if (!exists){
    db.contractHistories.create({
      contractAddress: "KT1NG33RboNuw4KSQmFBZtY5ast5334o5zfh",
      lastId: ''
    })
  }
  return res.status(200).send("configured");
})

// set port, listen for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}.`);
  // db.contractHistories.create({
  //   contractAddress: "KT1NG33RboNuw4KSQmFBZtY5ast5334o5zfh",
  //   lastId: ''
  // })
  // const main = require("./services/cron")
  // main.pollAuctionContract()
  // // main.pollInstanceContracts()
});

const Cron = require("./Cronjob");
Cron.pollAuctionContractCronJob();
Cron.pollInstaceContractsCronJob();