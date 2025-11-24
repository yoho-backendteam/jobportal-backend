import express from 'express'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import jobRoutes from './routes/jobRoutes.js'

dotenv.config()

connectDB()

const PORT = process.env.PORT || 5000
const app = express()

app.use(express.json())
app.use("/api/jobs", jobRoutes);


app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`)
})