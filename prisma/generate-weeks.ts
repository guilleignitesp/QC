import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const TARGET_DATE = new Date('2026-06-19')

    // 1. Obtener todas las clases base con sus profesores template
    const todasLasClases = await prisma.clase.findMany({
        include: { profesoresBase: true }
    })
    if (todasLasClases.length === 0) {
        console.error("❌ No hay clases base en la BD. Crea primero las clases.")
        return
    }

    // 2. Buscar la última semana registrada
    const ultimaSemana = await prisma.semana.findFirst({
        orderBy: { fechaInicio: 'desc' }
    })

    let fechaInicio: Date
    if (ultimaSemana) {
        fechaInicio = new Date(ultimaSemana.fechaInicio)
        fechaInicio.setDate(fechaInicio.getDate() + 7) // Saltar al siguiente lunes
    } else {
        // Si no hay nada, buscamos el lunes de esta semana actual
        fechaInicio = new Date()
        const day = fechaInicio.getDay()
        const diff = fechaInicio.getDate() - day + (day === 0 ? -6 : 1)
        fechaInicio.setDate(diff)
    }

    // Resetear horas para evitar problemas de desfase
    fechaInicio.setUTCHours(0, 0, 0, 0)

    console.log(`🚀 Generando semanas laborables (L-V) hasta junio 2026...`)

    while (fechaInicio <= TARGET_DATE) {
        // Calcular el viernes de esa misma semana (Lunes + 4 días)
        const fechaFin = new Date(fechaInicio)
        fechaFin.setDate(fechaInicio.getDate() + 4)
        fechaFin.setUTCHours(23, 59, 59, 999)

        // Crear el registro de la Semana
        const nuevaSemana = await prisma.semana.create({
            data: {
                fechaInicio: new Date(fechaInicio),
                fechaFin: new Date(fechaFin),
                activa: false
            }
        })

        // Vincular cada clase y "CONGELAR" sus profesores
        for (const clase of todasLasClases) {
            const cs = await prisma.claseSemana.create({
                data: {
                    claseId: clase.id,
                    semanaId: nuevaSemana.id,
                    estado: 'NORMAL'
                }
            })

            // Crear Asignaciones PERMANENTES basadas en el Template actual
            if (clase.profesoresBase.length > 0) {
                const asignaciones = clase.profesoresBase.map(profe => ({
                    claseSemanaId: cs.id,
                    profesorId: profe.id,
                    tipo: 'PERMANENTE',
                    origen: 'BASE',
                    activo: true
                }))

                // Tipado manual para evitar conflicto con la cadena literal vs string
                await prisma.asignacionProfesor.createMany({
                    data: asignaciones as any
                })
            }
        }

        console.log(`✅ Creada: Lunes ${fechaInicio.toLocaleDateString()} -> Viernes ${fechaFin.toLocaleDateString()}`)

        // Avanzar 7 días para el próximo lunes
        fechaInicio.setDate(fechaInicio.getDate() + 7)
    }

    console.log("✨ ¡Semanas generadas correctamente!")
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())