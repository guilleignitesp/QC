import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Normalizing profesoresMinimos to 1...')

    const result = await prisma.clase.updateMany({
        data: {
            profesoresMinimos: 1
        }
    })

    console.log(`✅ Updated ${result.count} classes.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
