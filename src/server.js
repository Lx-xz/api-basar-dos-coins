import express from 'express'
const app = express()
app.use(express.json())

import cors from 'cors'
app.use(cors())

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import bcrypt from 'bcrypt'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const server_url = process.env.SERVER_URL
const access_token = process.env.ACCESS_TOKEN

app.post('/shopping', (req,res) => {
    const client = new MercadoPagoConfig({ accessToken: access_token })

    const preference = new Preference(client)

    preference.create({
        body: {
            items: [
                {
                    title: 'Meu produto',
                    quantity: 1,
                    unit_price: 25
                }
            ],
            back_urls: {
                success: `${server_url}/shopping/success`,
                pending: `${server_url}/shopping/pending`,
                failure: `${server_url}/shopping/cancel`,
            }
        }
    })
    .then (response => res.json(response.init_point))
    .catch (error => res.status(500).json({ error: error.message}))
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
                    method: req.body.payment_method,
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
            include: {
                password: false,
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
        const updateData = {};
        if (req.body.nick) {
            updateData.nick = req.body.nick;
        }
        if (req.body.phone) {
            updateData.phone = req.body.phone;
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
                where: {
                    id: req.params.id
                },
                data: updateData
            });
            res.status(200).send();
        } else {
            res.status(400).send('No valid fields to update');
        }
    } catch {
        res.status(500).send();
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