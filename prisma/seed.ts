import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import 'dotenv/config'

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
})

// Sample data provided by user
const SAMPLES = [
    { s: "AMERICAN", sub: "Inf", d: 1, start: "15:45", end: "17:30", age: "P4-K5" },
    { s: "AMERICAN", sub: "Robotics", d: 1, start: "15:45", end: "17:30", age: "G1-3" },
    { s: "AULA", sub: "Coding", d: 3, start: "15:30", end: "17:00", age: "3-6PRIM" },
]

const SCHOOLS = ["AMERICAN", "AULA", "BRITISH", "SAN_PATRICIO"]
const SUBJECTS = ["Inf", "Robotics", "Coding", "Chess", "Drama", "Art", "Music"]
const AGES = ["P4-K5", "G1-3", "3-6PRIM", "ESO", "BACH"]
const TIME_SLOTS = [
    { start: "15:45", end: "17:30" },
    { start: "15:30", end: "17:00" },
    { start: "16:00", end: "17:30" },
    { start: "17:30", end: "19:00" },
]

async function main() {
    console.log('🌱 Starting seed...')

    // Test connection
    try {
        await prisma.$connect()
        console.log('✅ Connected to database')
    } catch (e) {
        console.error('❌ Failed to connect to database')
        throw e
    }

    // Cleanup
    await prisma.asignacionProfesor.deleteMany()
    await prisma.claseSemana.deleteMany()
    await prisma.clase.deleteMany()
    await prisma.profesor.deleteMany()
    await prisma.semana.deleteMany()
    await prisma.asignatura.deleteMany()
    await prisma.escuela.deleteMany()

    console.log('🧹 Database cleaned')

    // 1. Create Professors (30)
    const profesoresData = Array.from({ length: 30 }).map((_, i) => ({
        nombre: `Profesor ${i + 1}`,
        activo: true
    }))

    for (const p of profesoresData) {
        await prisma.profesor.create({ data: p })
    }
    console.log('👨‍🏫 Created 30 professors')

    // 2. Generator for 137 Classes
    const classesToCreate: any[] = []
    SAMPLES.forEach(s => classesToCreate.push(s))

    let counter = classesToCreate.length
    while (counter < 137) {
        const school = SCHOOLS[Math.floor(Math.random() * SCHOOLS.length)]
        const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]
        const age = AGES[Math.floor(Math.random() * AGES.length)]
        const time = TIME_SLOTS[Math.floor(Math.random() * TIME_SLOTS.length)]
        const day = Math.floor(Math.random() * 5) + 1

        classesToCreate.push({
            s: school,
            sub: subject,
            d: day,
            start: time.start,
            end: time.end,
            age: age
        })
        counter++
    }

    // 3. Process Unique Schools and Subjects
    const uniqueSchools = new Set(classesToCreate.map(c => c.s))
    const uniqueSubjects = new Set(classesToCreate.map(c => c.sub))

    const schoolMap = new Map<string, string>()
    for (const name of uniqueSchools) {
        const created = await prisma.escuela.create({ data: { nombre: name } })
        schoolMap.set(name, created.id)
    }

    const subjectMap = new Map<string, string>()
    for (const name of uniqueSubjects) {
        const created = await prisma.asignatura.create({ data: { nombre: name } })
        subjectMap.set(name, created.id)
    }

    // 4. Create Classes
    const baseDate = new Date('2026-02-02T00:00:00Z')
    const semana = await prisma.semana.create({
        data: {
            fechaInicio: baseDate,
            fechaFin: new Date('2026-02-08T23:59:59Z'),
            activa: true
        }
    })

    let createdClassesCount = 0
    for (const item of classesToCreate) {
        const [startH, startM] = item.start.split(':').map(Number)
        const [endH, endM] = item.end.split(':').map(Number)

        const startTimeParams = new Date(0)
        startTimeParams.setUTCHours(startH, startM, 0, 0)

        const endTimeParams = new Date(0)
        endTimeParams.setUTCHours(endH, endM, 0, 0)

        const clase = await prisma.clase.create({
            data: {
                escuelaId: schoolMap.get(item.s)!,
                asignaturaId: subjectMap.get(item.sub)!,
                diaSemana: item.d,
                horaInicio: startTimeParams,
                horaFin: endTimeParams,
                profesoresMinimos: 1,
            }
        })

        await prisma.claseSemana.create({
            data: {
                claseId: clase.id,
                semanaId: semana.id,
                estado: "NORMAL"
            }
        })

        createdClassesCount++
    }

    console.log(`✅ Base de datos poblada con éxito con ${createdClassesCount} clases reales.`)
}

main()
    .catch((e) => {
        console.error(e)
        // Write error to file for agent reading
        try {
            fs.writeFileSync('seed_error_log.txt', JSON.stringify({
                message: e.message,
                stack: e.stack,
                name: e.name
            }, null, 2))
        } catch (fsErr) {
            console.error('Failed to write log', fsErr)
        }
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
