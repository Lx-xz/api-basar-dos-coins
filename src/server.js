import express from 'express'
const app = express()
app.use(express.json())

import cors from 'cors'
app.use(cors())

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import Stripe from 'stripe'
import bcrypt from 'bcrypt'

const server_url = process.env.SERVER_URL
const stripe_secret = process.env.STRIPE_SECRET_KEY

app.post('/shopping', async (req,res) => {
    const stripe = new Stripe(stripe_secret)

    try {
        let { item, unitPrice, image_url } = await prisma.stock.findFirst({})
        unitPrice = parseInt(unitPrice * 100) // Convert to cents

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card', 'boleto'],

            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: item,
                        images: [image_url]
                    },
                    unit_amount: unitPrice
                },
                quantity: req.body.item.quantity
            }],

            success_url: `${server_url}/shopping/success`,
            cancel_url: `${server_url}/shopping/cancel`
        })
        res.json({ url: session.url })
    }
    catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

app.post('/shopping/register', async (req,res) => {
    try {
        let stock = await prisma.stock.findUnique({
            where: {
                id: req.body.purchase.id
            }
        })

        if (stock.quantity < req.body.purchase.quantity) {
            res.status(400).send('Not enough stock')
        }
        else {
            let value = stock.unitPrice * req.body.purchase.quantity
            value = parseFloat(value.toFixed(2))

            let shopping = await prisma.shopping.create({
                data: {
                    platform: 'PC',
                    quantity: req.body.purchase.quantity,
                    value: value,
                    status: 'success',
                    date: new Date(),
        
                    buyer: {
                        connect: {
                            id: req.body.user.id
                        } 
                    } 
                }
            })
        
            await prisma.stock.update({
                where: {
                    id: req.body.purchase.id
                },
                data: {
                    quantity: {
                        decrement: req.body.purchase.quantity
                    }
                }
            })

            res.status(201).send(shopping)
        }
    }
    catch {
        res.status(500)
    }
})

app.post('/addStock', async (req,res) => {
    try {
        await prisma.stock.update({
            where: {
                id: '676ee8346b6c8dd8cc690bc0'
            },
            data: {
                quantity: {
                    increment: req.body.quantity
                }
            }
        })

        res.status(201).send()
    }
    catch {
        res.status(500)
    }
})

app.get('/admin', async (req,res) => {
    let stock = await prisma.stock.findFirst({
        select: {
            item: true,
            quantity: true
        }
    })

    let sales = await prisma.shopping.findMany({
        select: {
            id: true,
            quantity: true,
            platform: true,
            status: true,
            value: true,
            date: true,
            buyer: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    })

    let users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true
        }
    })

    res.json({users, stock, sales})
})

app.post('/user', async (req,res) => {
    let user = await prisma.user.findUnique({
        where: {
            id: req.body.id
        }
    })

    if (user === null) {
        res.status(404).send()
    }
    else {
        res.json(user)
    }
})

app.get('/user/:id', async (req,res) => {
    try {
        let user = await prisma.user.findUnique({
            where: {
                id: req.params.id
            },
            select: {
                nick: true,
                shopping: {
                    select: {
                        id: true,
                        quantity: true,
                        platform: true,
                        value: true,
                        date: true
                    }
                }
            }
        })

        res.json(user)
    }
    catch {
        res.status(500).send()
    }
})

app.put('/user/:id', async (req,res) => {
    try {
        await prisma.user.update({
            where: {
                id: req.params.id
            },
            data: {
                nick: req.body.nick
            }
        })

        res.status(200).send()
    }
    catch {
        res.status(500).send()
    }
})

app.post('/user/login', async (req,res) => {
    let user = await prisma.user.findUnique({
        where: { 
            email: req.body.email
        }
    })

    if (user == null) {
        return res.json({error: 'Unregistered email'})
    }

    try {
        if (await bcrypt.compare(req.body.password, user.password))
        {
            let { password, ...userWithoutPassword } = user
            res.status(200).json(userWithoutPassword)
        }
        else {
            res.json({error: 'Wrong Password'})
        }
    }
    catch
    {
        res.status(500).send()
    }
})

app.post('/user/create', async (req,res) => {
    let user = await prisma.user.findUnique({
        where: { 
            email: req.body.email
        }
    })

    if (user != null) {
        return res.send('Email is already registered')
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    await prisma.user.create({
        data: {
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
        }
    })

    res.status(201).send()
})

app.listen(3000)