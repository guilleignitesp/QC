import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Sincronizando datos con el modelo Template vs Instance...')

    // 1. Encontrar asignaciones que deben ser migradas (Permanentes y Activas)
    // Estas son redundantes ahora y deben estar en el Template (Clase)
    const activePermanentAssignments = await prisma.asignacionProfesor.findMany({
        where: {
            tipo: 'PERMANENTE',
            origen: 'BASE',
            activo: true
        },
        include: {
            claseSemana: true
        }
    })

    console.log(`📦 Encontradas ${activePermanentAssignments.length} asignaciones base activas.`)

    const teachersToConnect = new Map<string, Set<string>>() // claseId -> Set<profesorId>

    for (const assign of activePermanentAssignments) {
        const claseId = assign.claseSemana.claseId
        const profesorId = assign.profesorId

        if (!teachersToConnect.has(claseId)) {
            teachersToConnect.set(claseId, new Set())
        }
        teachersToConnect.get(claseId)?.add(profesorId)
    }

    // 2. Conectar Profesores a Clase (Template)
    let movedCount = 0
    for (const [claseId, teacherIds] of teachersToConnect.entries()) {
        console.log(`   👉 Conectando ${teacherIds.size} profesores a Clase ${claseId}`)

        await prisma.clase.update({
            where: { id: claseId },
            data: {
                profesoresBase: {
                    connect: Array.from(teacherIds).map(id => ({ id }))
                }
            }
        })
        movedCount += teacherIds.size
    }

    // 3. Limpiar redundancia
    // Borramos SOLO las asignaciones que hemos migrado (Permanente + Base + Activo)
    // Mantenemos las 'activo: false' (excepciones de ausencia)
    const deleted = await prisma.asignacionProfesor.deleteMany({
        where: {
            tipo: 'PERMANENTE',
            origen: 'BASE',
            activo: true
        }
    })

    console.log('✅ Migración completada.')
    console.log(`   - Profesores conectados al Template: ${movedCount}`)
    console.log(`   - Registros semanales limpiados: ${deleted.count}`)
    console.log('   - Las excepciones (ausencias) y sustituciones se han mantenido intactas.')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
