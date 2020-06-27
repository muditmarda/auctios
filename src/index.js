const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const fileType = require("file-type");

const app = express();

var corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./models");
db.sequelize.sync();

const main = require("./services/main");

app.post("/shortlist-auction", (req, res) => {});

// File upload
const { imageFilter } = require("./services/multer.js");

const UPLOAD_PATH = "images/";

// Only 1 file of max. 10 Mb(approx.) allowed
const upload = multer({
  dest: UPLOAD_PATH,
  limits: { fileSize: 10000000, files: 1 },
  fileFilter: imageFilter,
}).single("image");

app.post("/update-auction-details", async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const userPubKey = req.body.userPubKey;
    if (!userPubKey) {
      return res.status(400).send("Missing parameter user public key");
    }

    const assetId = req.body.assetId;
    if (!assetId) {
      return res.status(400).send("Missing parameter assetId");
    }

    const assetName = req.body.assetName;
    if (!assetName) {
      return res.status(400).send("Missing parameter assetName");
    }

    const description = req.body.description;
    if (!description) {
      return res.status(400).send("Missing parameter asset description");
    }

    const auctionType = req.body.auctionType;
    if (!auctionType) {
      return res.status(400).send("Missing parameter auctionType");
    }

    const contractAddress = req.body.contractAddress;
    if (!contractAddress) {
      return res.status(400).send("Missing parameter contract address");
    }

    const startTime = req.body.startTime;
    if (!startTime) {
      return res.status(400).send("Missing parameter startTime");
    }

    const waitTime = req.body.waitTime;
    if (!waitTime) {
      return res.status(400).send("Missing parameter waitTime");
    }

    const auctionParams = req.body.auctionParams;
    if (!auctionParams) {
      return res.status(400).send("Missing parameter auctionParams");
    }

    if (!req.file) {
      return res.status(400).send("Please upload a file");
    }

    let path = `/${UPLOAD_PATH}${req.file.filename}`;

    await main.updateAuctionDetails(
      userPubKey,
      assetId,
      assetName,
      auctionType,
      contractAddress,
      startTime,
      waitTime,
      auctionParams,
      description,
      path
    );
    return res
      .status(200)
      .json({ message: "Image Uploaded Successfully !", path: path });
  });
});

app.get("/images/:imagename", (req, res) => {
  let imagename = req.params.imagename;
  let imagepath = __dirname.slice(0, -4) + "/" + UPLOAD_PATH + imagename;
  let image = fs.readFileSync(imagepath);
  let mime = fileType(image).mime;

  res.writeHead(200, { "Content-Type": mime });
  res.end(image, "binary");
});

app.get("/auctions", async (req, res) => {
  if (!Object.keys(req.query).length) {
    // send all auctions
    const resp = await main.getAuctions();
    return res.status(200).send(resp);
  } else if (Object.keys(req.query).length === 1 && req.query.user_pub_key) {
    // send auctions for user_pub_key
    const resp = await main.getAuctions(req.query.user_pub_key);
    return res.status(200).send(resp);
  } else {
    // send all auctions or error ?
    return res.status(400).send();
  }
});

app.get("/configure", async (req, res) => {
  const exists = db.contractHistories.findOne({
    // TODO: store master auction contract address in config and fetch from there
    where: { contractAddress: "KT1NG33RboNuw4KSQmFBZtY5ast5334o5zfh" },
  });
  if (!exists) {
    db.contractHistories.create({
      contractAddress: "KT1NG33RboNuw4KSQmFBZtY5ast5334o5zfh",
      lastId: "",
    });
  }
  return res.status(200).send("configured");
});

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
