const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eqwoetz.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        await client.connect();

        const db = client.db('thread-ops')
        const productsCollection = db.collection('products')

        app.get('/topProducts', async(req, res)=>{
            const query = {showOnHomePage: true}

            const cursor = productsCollection.find(query)
            const result =  await cursor.toArray()
            res.send(result)
        })

        app.get('/products', async(req, res)=>{
            const cursor = productsCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('ThreadOps server is running.')
})

app.listen(port, () => {
    console.log(`TasteHouse server is running on port: ${port}`)
})