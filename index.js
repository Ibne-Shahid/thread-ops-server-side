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
        const usersCollection = db.collection('users')

        // Products APIs 

        app.get('/topProducts', async (req, res) => {
            const query = { showOnHomePage: true }

            const cursor = productsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/products', async (req, res) => {
            const { limit = 0, skip = 0 } = req.query
            const cursor = productsCollection.find().limit(Number(limit)).skip(Number(skip))
            const result = await cursor.project({ productDescription: 0, demoVideoLink: 0 }).toArray()
            res.send(result)
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;

            let result = null;

            if (ObjectId.isValid(id)) {
                result = await productsCollection.findOne({ _id: new ObjectId(id) });
            }

            if (!result) {
                result = await productsCollection.findOne({ _id: id });
            }

            res.send(result);
        });


        app.get("/productsCount", async (req, res) => {
            const count = await productsCollection.estimatedDocumentCount();
            res.send({ count });
        });



        // Users Apis 

        app.get('/users', async(req, res)=>{
            const email = req.query.email
            const query = {}
            if (email){
                query.email = email
                const result = await usersCollection.findOne(query)
                res.send(result)
            }
            const cursor = usersCollection.find()
            const result = await cursor.toArray()
            res.send(result)

        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)

            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null });
            }

            const result = await usersCollection.insertOne(user);
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