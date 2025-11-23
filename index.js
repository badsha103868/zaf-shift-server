const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// generate tracking id
const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex

  return `${prefix}-${date}-${random}`;
}

// stripe connection string
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware
app.use(express.json());
app.use(cors());

//  mongo db connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@portfolio-cluster1.ea8n2bl.mongodb.net/?appName=portfolio-cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("zap_shift_db");
    const parcelsCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments");

    // parcel api
    app.get("/parcels", async (req, res) => {
      // nijer parcel pete query parameter use

      // parcel?.email="badshagolder5@gmail.com"&
      const query = {};

      const { email } = req.query;
      //  check
      if (email) {
        query.senderEmail = email;
      }
      //  sort ar jonnor options
      const options = { sort: { createdAt: -1 } };

      const cursor = parcelsCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    // paid status update ar jonno api create
    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.findOne(query);
      res.send(result);
    });

    // post api
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      // time created with post
      parcel.createdAt = new Date();

      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    });

    // delete
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await parcelsCollection.deleteOne(query);
      res.send(result);
    });

    // stripe payment apis
    app.post("/create-checkout-session", async (req, res) => {
      // client theka data info naoua
      const paymentInfo = req.body;
      // amount set
      const amount = parseInt(paymentInfo.cost) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: `Please pay for: ${paymentInfo.parcelName}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.senderEmail,
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.parcelId,
          parcelName: paymentInfo.parcelName,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      console.log(session);
      res.send({ url: session.url });
    });

    //  payment status update api
    app.patch("/payment-success", async (req, res) => {
      // search url theke session_id ashtese tai query use korsi

      const sessionId = req.query.session_id;
      // console.log('session id', sessionId)

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      console.log("session retrieve", session);

      const alreadyPaid = await paymentCollection.findOne({
        transactionId: session.payment_intent,
      });

      if (alreadyPaid) {
        return res.send({
          success: false,
          message: "Payment already processed",
        });
      }

      // tracking id  call
      const trackingId = generateTrackingId();

      //  jodi  payment status paid hoi
      if (session.payment_status === "paid") {
        // id khujte
        const id = session.metadata.parcelId;
        // id match korte
        const query = { _id: new ObjectId(id) };
        //  akhon update korbo
        const update = {
          $set: {
            paymentStatus: "paid",
            trackingId: trackingId,
          },
        };

        //  akhon result kora update korbo
        const result = await parcelsCollection.updateOne(query, update);

        //  payment hour sata sata data mongo db

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelId,
          parcelName: session.metadata.parcelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        };

        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollection.insertOne(payment);

           res.send({
            success: true,
            message: "Payment processed successfully",
            modifyParcel: result,
            trackingId: trackingId,
             transactionId: session.payment_intent,
            paymentInfo: resultPayment,
          });
        }
      }

      res.send({ success: false });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("zap shifting shifting running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
