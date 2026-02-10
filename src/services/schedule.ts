import db from '@/lib/db'

export async function getWeeklySchedule(semanaId: string) {
    const rawSchedule = await db.claseSemana.findMany({
        where: {
            semanaId: semanaId,
        },
        include: {
            clase: {
                include: {
                    escuela: true,
                    asignatura: true,
                    profesoresBase: true, // Fetch Template
                },
            },
            asignacionesProfesor: {
                include: {
                    profesor: true,
                },
            },
        },
        orderBy: [
            { clase: { diaSemana: 'asc' } },
            { clase: { horaInicio: 'asc' } },
        ],
    })

    // Transform Logic: Merge Template + Exceptions
    const schedule = rawSchedule.map(cs => {
        const baseTeachers = cs.clase.profesoresBase
        const exceptions = cs.asignacionesProfesor // TEMPORAL or Inactive records

        // 1. Start with Base Teachers
        // Check if any Base Teacher has a matching Exception (moved/absent)
        const mergedAssignments = baseTeachers.map(base => {
            // Can be marked inactive by a specific record in asignacionesProfesor
            const exception = exceptions.find(e => e.profesorId === base.id && e.origen === 'BASE')

            // If explicit exception says "activo: false", respect it.
            // If no exception found, they are ACTIVE by default (Template behavior)
            const isActive = exception ? exception.activo : true

            return {
                id: exception?.id || `base-${base.id}`, // Virtual ID if no exception record exists
                profesorId: base.id,
                profesor: base,
                tipo: 'PERMANENTE',
                origen: 'BASE',
                activo: isActive
            }
        })

        // 2. Add Substitutes (Temporal assignments)
        const substitutes = exceptions.filter(e => e.tipo === 'TEMPORAL')

        // Combine arrays
        const finalAssignments = [...mergedAssignments, ...substitutes]

        return {
            ...cs,
            asignacionesProfesor: finalAssignments
        }
    })

    return schedule
}

export async function getActiveWeek() {
    const week = await db.semana.findFirst({
        where: {
            activa: true,
        },
    })
    return week
}

export async function getSchools() {
    const schools = await db.escuela.findMany({
        orderBy: {
            nombre: 'asc',
        },
    })
    return schools
}

export async function getAllWeeks() {
    return await db.semana.findMany({
        orderBy: { fechaInicio: 'asc' }
    })
}

export async function getWeekById(id: string) {
    return await db.semana.findUnique({
        where: { id }
    })
}
