import cors from 'cors'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import express from 'express'
const app = express()
app.use(express.json())
app.use(cors())

import bcrypt from 'bcrypt'

app.post('/login', async (req,res) => {
    const user = await prisma.user.findUnique({
        where: { 
            email: req.body.email
        }
    })

    if (user == null) {
        return res.send('Unregistered email')
    }

    try {
        if (await bcrypt.compare(req.body.password, user.password))
        {
            res.status(200).json(user)
        }
        else {
            res.send('Wrong Password')
        }
    }
    catch
    {
        res.status(500).send()
    }
})

app.post('/createAccount', async (req,res) => {
    const user = await prisma.user.findUnique({
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