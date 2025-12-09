const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const stripe = require('stripe')(process.env.STRIPE_SECRET);

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
        const ordersCollection = db.collection('orders')


        // Products APIs 

        app.get('/topProducts', async (req, res) => {
            const query = { showOnHomePage: true }

            const cursor = productsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id
            const updatedProduct = req.body

            if (!updatedProduct) {
                return res.status(400).send({ message: "Invalid product data" });
            }
            const { productName, category, price, availableQuantity, minimumOrderQuantity, paymentOption, images } = updatedProduct

            const query = {
                $or: [
                    { _id: id },
                    { _id: new ObjectId(id) }
                ]
            }

            const updatedDoc = {
                $set: {
                    productName,
                    category,
                    price,
                    availableQuantity,
                    minimumOrderQuantity,
                    paymentOption,
                    images: images || [],
                    updatedAt: new Date()
                }
            }

            const result = await productsCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.patch('/products/:id/showOnHome', async (req, res) => {
            const id = req.params.id
            const { showOnHomePage } = req.body
            const query = {
                $or: [
                    { _id: id },
                    { _id: new ObjectId(id) }
                ]
            };
            const updatedDoc = {
                $set: {
                    showOnHomePage
                }
            }
            const result = await productsCollection.updateOne(query, updatedDoc)
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

        app.get('/users', async (req, res) => {
            const email = req.query.email
            const query = {}
            if (email) {
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

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: "approved",
                    updatedAt: new Date()
                }
            }

            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        app.patch('/users/:id/role', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "admin",
                    updatedAt: new Date()
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // Orders related APIs 

        app.get('/orders', async (req, res) => {

            const email = req.query.email
            const query = {}
            if (email) {
                query.buyerEmail = email
            }
            const curson = ordersCollection.find(query)
            const result = await curson.toArray()
            res.send(result)
        })

        app.post('/orders', async (req, res) => {
            const order = req.body
            order.paymentStatus = 'Pending'
            order.status = 'Pending'
            order.transactionId = null
            order.tracingId = null
            order.orderDate = new Date()

            const result = await ordersCollection.insertOne(order)

            res.send({ insertedId: result.insertedId })
        })

        app.delete('/orders/:id', async (req, res) => {
            const orderId = req.params.id;

            try {
                const result = await ordersCollection.deleteOne({
                    _id: new ObjectId(orderId),
                    paymentStatus: "Pending",
                    paymentMethod: "Stripe"
                });

                if (result.deletedCount > 0) {
                    return res.send({ success: true, message: "Pending order deleted" });
                }

                res.send({ success: false, message: "Order not found or cannot delete" });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });



        // Payment related APIs 

        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const quantity = parseInt(paymentInfo.quantity)
            const amount = paymentInfo.productPrice * 100

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: amount,
                            product_data: {
                                name: paymentInfo.productTitle
                            }
                        },
                        quantity: quantity
                    },
                ],
                customer_email: paymentInfo?.buyerEmail,
                mode: 'payment',
                metadata: {
                    productId: paymentInfo.productId,
                    orderId: paymentInfo.orderId
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled?session_id={CHECKOUT_SESSION_ID}&orderId=${paymentInfo.orderId}`,

            })

            res.send({ url: session.url });


        })

        app.get('/verify-payment', async (req, res) => {
            const sessionId = req.query.session_id;

            const session = await stripe.checkout.sessions.retrieve(sessionId);

            const orderId = session.metadata.orderId;

            if (session.payment_status === "paid") {
                await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            paymentStatus: "Paid",
                            transactionId: session.payment_intent
                        }
                    }
                );

                return res.send({ success: true });
            }

            res.send({ success: false });
        });



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