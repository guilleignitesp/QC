import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const DAY_MAP: Record<string, number> = {
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5
}

function parseTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const date = new Date()
    date.setUTCHours(hours, minutes, 0, 0) // Use UTC to avoid timezone issues in storage
    return date
}

async function main() {
    console.log('🌱 Starting Seed from Real Data...')

    // 1. Clean Database
    console.log('🧹 Cleaning database...')
    await prisma.registroCambio.deleteMany()
    await prisma.asignacionProfesor.deleteMany()
    await prisma.claseSemana.deleteMany()
    await prisma.clase.deleteMany()
    await prisma.profesor.deleteMany()
    await prisma.asignatura.deleteMany()
    await prisma.escuela.deleteMany()
    await prisma.semana.deleteMany()

    // 2. Read CSV
    const csvPath = path.join(process.cwd(), 'prisma', 'clases_reales.csv')
    const fileContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = fileContent.trim().split('\n')

    // Skip header
    const dataLines = lines.slice(1)

    console.log(`📂 Found ${dataLines.length} rows in CSV.`)

    // Cache to avoid repeated DB lookups
    const schools = new Map<string, string>()
    const subjects = new Map<string, string>()
    const teachers = new Map<string, string>()

    // 3. Create Active Week
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
    startOfWeek.setUTCHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setUTCHours(23, 59, 59, 999)

    const activeWeek = await prisma.semana.create({
        data: {
            fechaInicio: startOfWeek,
            fechaFin: endOfWeek,
            activa: true
        }
    })
    console.log(`📅 Created Active Week: ${startOfWeek.toISOString().split('T')[0]}`)

    // 4. Process Rows
    for (const line of dataLines) {
        if (!line.trim()) continue

        // Handle CSV parsing crudely (assuming no internal commas in fields for now based on sample)
        const [group_id, schoolName, subjectName, startTime, endTime, dayStr, age, teacherStr] = line.split(',')

        process.stdout.write('.')

        // Upsert School
        if (!schools.has(schoolName)) {
            const s = await prisma.escuela.create({ data: { nombre: schoolName } })
            schools.set(schoolName, s.id)
        }

        // Upsert Subject
        if (!subjects.has(subjectName)) {
            const s = await prisma.asignatura.create({ data: { nombre: subjectName } })
            subjects.set(subjectName, s.id)
        }

        // Upsert Teachers
        const teacherNames = teacherStr.split('_').map(t => t.trim()).filter(t => t)
        const teacherIds: string[] = []

        for (const tName of teacherNames) {
            if (!teachers.has(tName)) {
                // Check if exists in DB from previous run or just create
                // Since we wiped data, checking map is enough, but concurrent calls might race if we parallelized.
                // Here we are sequential.
                const t = await prisma.profesor.create({ data: { nombre: tName, activo: true } })
                teachers.set(tName, t.id)
                teacherIds.push(t.id)
            } else {
                teacherIds.push(teachers.get(tName)!)
            }
        }

        // Create Clase (Template)
        const dayInt = DAY_MAP[dayStr.trim()]
        if (!dayInt) {
            console.warn(`⚠️ Invalid day: ${dayStr}`)
            continue
        }

        const clase = await prisma.clase.create({
            data: {
                escuelaId: schools.get(schoolName)!,
                asignaturaId: subjects.get(subjectName)!,
                diaSemana: dayInt,
                horaInicio: parseTime(startTime),
                horaFin: parseTime(endTime),
                profesoresMinimos: 1, // Default
                edad: age, // Map CSV 'age' to DB 'edad'
                profesoresBase: {
                    connect: teacherIds.map(id => ({ id }))
                }
            }
        })

        // Create ClaseSemana (Instance)
        await prisma.claseSemana.create({
            data: {
                claseId: clase.id,
                semanaId: activeWeek.id,
                estado: 'NORMAL'
            }
        })
        // Note: We DO NOT create AsignacionProfesor records for base teachers anymore!
        // The Template model handles them.
    }

    console.log('\n✅ Seed Completed Successfully!')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
