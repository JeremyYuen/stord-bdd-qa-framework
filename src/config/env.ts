import * as dotenv from 'dotenv'

dotenv.config()

export const BASE_URL = process.env.BASE_URL || 'https://www.stord.com'

// API scenarios run against a public mock API: stord.com has no public API to test safely
export const API_BASE_URL = process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com'

export const HEADED = process.env.HEADED === 'true'

// Milliseconds added between browser actions so a headed run is watchable (0 = full speed)
export const SLOW_MO = Number(process.env.SLOW_MO) || 0
