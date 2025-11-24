import express from 'express'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import jobRoutes from './routes/jobRoutes.js'
import userRoutes from './routes/userRoutes.js'
import otpRoutes from './routes/otpRoutes.js'

dotenv.config()

connectDB()

const PORT = process.env.PORT || 5000
const app = express()

app.use(express.json({ limit: '10mb' }));
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/otp", otpRoutes);


app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`)
})