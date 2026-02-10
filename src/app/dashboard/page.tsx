import { getActiveWeek, getSchools, getWeeklySchedule, getAllWeeks, getWeekById } from '@/services/schedule'
import { getWeeklyIncidents } from '@/services/substitution'
import { Clock } from 'lucide-react'
import DashboardClient from '@/components/dashboard/DashboardClient'

// --- Tipos y Constantes ---
const DAYS = [
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
]

type Props = {
    searchParams: Promise<{ semanaId?: string }>
}

export default async function DashboardPage(props: Props) {
    const searchParams = await props.searchParams;
    const { semanaId } = searchParams;

    // 1. Determine which week to show
    let activeWeek: any = null;

    if (semanaId) {
        activeWeek = await getWeekById(semanaId)
    } else {
        activeWeek = await getActiveWeek()
    }

    // Fallback if requested ID doesn't exist or no active week
    if (!activeWeek) {
        // Try fallback to the first available week if specific one failed
        const weeks = await getAllWeeks()
        if (weeks.length > 0) activeWeek = weeks[0]
    }

    if (!activeWeek) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <div className="bg-rose-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-rose-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">No hay semanas configuradas</h1>
                    <p className="text-slate-500 mt-2">Ejecuta el script de generación para crear semanas.</p>
                </div>
            </div>
        )
    }

    // 2. Fetch Data in Parallel
    const [schools, weeklySchedule, allWeeks, incidents] = await Promise.all([
        getSchools(),
        getWeeklySchedule(activeWeek.id),
        getAllWeeks(),
        getWeeklyIncidents(activeWeek.id)
    ])

    // 3. Construcción de la estructura de la Matriz
    const matrix: Record<string, Record<number, any[]>> = {}

    schools.forEach(school => {
        matrix[school.id] = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    })

    weeklySchedule.forEach(item => {
        const day = item.clase.diaSemana
        const schoolId = item.clase.escuela.id

        if (day >= 1 && day <= 5 && matrix[schoolId]) {
            matrix[schoolId][day].push(item)
        }
    })

    // 4. Renderizado del Componente Cliente
    return (
        <DashboardClient
            schools={schools}
            matrix={matrix}
            activeWeek={activeWeek}
            allWeeks={allWeeks}
            incidents={incidents}
        />
    )
}