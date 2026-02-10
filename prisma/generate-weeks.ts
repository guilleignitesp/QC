import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('⏳ Generando próximas 4 semanas...')

    const clasesBase = await prisma.clase.findMany({
        include: { asignatura: true, escuela: true }
    })

    const profesores = await prisma.profesor.findMany()

    // Fecha de inicio de la siguiente semana (9 de Febrero 2026)
    let fechaInicioRef = new Date('2026-02-09T00:00:00.000Z')

    for (let i = 0; i < 4; i++) {
        const fechaFinRef = new Date(fechaInicioRef)
        fechaFinRef.setDate(fechaFinRef.getDate() + 6)
        fechaFinRef.setUTCHours(23, 59, 59, 999)

        // 1. Crear la Semana
        const nuevaSemana = await prisma.semana.create({
            data: {
                fechaInicio: fechaInicioRef,
                fechaFin: fechaFinRef,
                activa: false // Solo una debe ser activa, la actual
            }
        })

        console.log(`✅ Semana creada: ${fechaInicioRef.toISOString().split('T')[0]}`)

        // 2. Crear ClaseSemana y Asignaciones para cada clase base
        for (const clase of clasesBase) {
            const cs = await prisma.claseSemana.create({
                data: {
                    claseId: clase.id,
                    semanaId: nuevaSemana.id,
                    estado: 'NORMAL'
                }
            })

            // Asignar 1 profesor aleatorio como PERMANENTE (para tener datos)
            const profeAleatorio = profesores[Math.floor(Math.random() * profesores.length)]

            await prisma.asignacionProfesor.create({
                data: {
                    profesorId: profeAleatorio.id,
                    claseSemanaId: cs.id,
                    tipo: 'PERMANENTE',
                    origen: 'BASE',
                    activo: true
                }
            })
        }

        // Avanzar la referencia 7 días para la siguiente iteración
        fechaInicioRef = new Date(fechaInicioRef)
        fechaInicioRef.setDate(fechaInicioRef.getDate() + 7)
    }

    console.log('🚀 ¡4 semanas adicionales generadas con éxito!')
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())