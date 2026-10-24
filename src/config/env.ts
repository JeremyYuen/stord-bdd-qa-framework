import * as dotenv from 'dotenv'

dotenv.config()

export const BASE_URL = process.env.BASE_URL || 'https://www.stord.com'

export const HEADED = process.env.HEADED === 'true'

// Milliseconds added between browser actions so a headed run is watchable (0 = full speed)
export const SLOW_MO = Number(process.env.SLOW_MO) || 0
