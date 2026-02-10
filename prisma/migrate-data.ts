import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Iniciando migración de profesores a Template (Clase)...')

    // 1. Obtener todas las Clases Base
    const clases = await prisma.clase.findMany({
        include: {
            clasesSemana: {
                include: {
                    asignacionesProfesor: {
                        where: { tipo: 'PERMANENTE' }
                    }
                }
            }
        }
    })

    console.log(`📦 Encontradas ${clases.length} clases base.`)

    let totalMovidos = 0
    let totalBorrados = 0

    for (const clase of clases) {
        // Encontrar profesores permanentes únicos en las instancias de esta clase
        const uniqueTeacherIds = new Set<string>()

        clase.clasesSemana.forEach(cs => {
            cs.asignacionesProfesor.forEach(ap => {
                uniqueTeacherIds.add(ap.profesorId)
            })
        })

        if (uniqueTeacherIds.size > 0) {
            console.log(`   👉 Clase ${clase.id.substring(0, 8)} (${uniqueTeacherIds.size} profes): Connectando a Base...`)

            // Conectar a la Clase Base
            await prisma.clase.update({
                where: { id: clase.id },
                data: {
                    profesoresBase: {
                        connect: Array.from(uniqueTeacherIds).map(id => ({ id }))
                    }
                }
            })
            totalMovidos += uniqueTeacherIds.size
        }
    }

    // 2. Borrar las asignaciones PERMANENTE antiguas (ya son redundantes)
    // Borramos todas las asignaciones tipo PERMANENTE
    const deleted = await prisma.asignacionProfesor.deleteMany({
        where: { tipo: 'PERMANENTE' }
    })

    totalBorrados = deleted.count

    console.log('✅ Migración completada.')
    console.log(`   - Profesores conectados a Templates: ${totalMovidos}`)
    console.log(`   - Asignaciones redundantes eliminadas: ${totalBorrados}`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
