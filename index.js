const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

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
    const parcelsCOllection = db.collection("parcels");

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

      const cursor = parcelsCOllection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    // paid status update ar jonno api create
    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCOllection.findOne(query);
      res.send(result);
    });

    // post api
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      // time created with post
      parcel.createdAt = new Date();

      const result = await parcelsCOllection.insertOne(parcel);
      res.send(result);
    });

    // delete
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCOllection.deleteOne(query);
      res.send(result);
    });

    // stripe payment apis
    app.post("/create-checkout-session", async (req, res) => {
      // client theka data info naoua
      const paymentInfo = req.body;


      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data:{
              currency: 'USD',
              unit_amount: 1500,
              product_data: {
                name: paymentInfo.parcelName
              }
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.senderEmail,
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
      });
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
