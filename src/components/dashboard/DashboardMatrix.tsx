'use client'

import { Clock, Plus, ChevronRight } from 'lucide-react'

const DAYS = [
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' },
]

const SUBJECT_STYLES: Record<string, string> = {
    'Inf': 'border-emerald-500 text-emerald-900 bg-emerald-50/60 hover:bg-emerald-100/80',
    'Robotics': 'border-sky-500 text-sky-900 bg-sky-50/60 hover:bg-sky-100/80',
    'Coding': 'border-amber-500 text-amber-900 bg-amber-50/60 hover:bg-amber-100/80',
    'Minecraft': 'border-violet-500 text-violet-900 bg-violet-50/60 hover:bg-violet-100/80',
    '3d & VR': 'border-rose-500 text-rose-900 bg-rose-50/60 hover:bg-rose-100/80',
    'default': 'border-slate-300 text-slate-700 bg-slate-50/60 hover:bg-slate-100/80'
}

function getCardStyle(subjectName: string) {
    const key = Object.keys(SUBJECT_STYLES).find(k => subjectName.includes(k)) || 'default'
    return SUBJECT_STYLES[key]
}

function formatTime(dateStr: string | Date) {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    })
}

type Props = {
    schools: any[]
    matrix: Record<string, Record<number, any[]>>
    onClassClick: (claseSemana: any) => void
}

export default function DashboardMatrix({ schools, matrix, onClassClick }: Props) {
    return (
        <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <table className="border-collapse w-full min-w-[1600px] table-fixed">
                {/* Sticky Header: Days */}
                <thead className="sticky top-0 z-30">
                    <tr>
                        {/* Corner Cell */}
                        <th className="sticky left-0 top-0 z-40 w-72 bg-white/95 backdrop-blur-md border-b border-r border-slate-200 p-4 text-left font-extrabold text-slate-800 shadow-sm shrink-0">
                            School Name
                        </th>
                        {/* Day Headers Glassmorphism */}
                        {DAYS.map(day => (
                            <th key={day.id} className="bg-white/90 backdrop-blur-md border-b border-r border-slate-100 p-4 text-center w-80">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Day {day.id}</span>
                                    <span className="text-lg font-bold text-slate-800">{day.name}</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                    {schools.map((school, index) => (
                        <tr
                            key={school.id}
                            className={`group transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`} // Zebra Stripe
                        >

                            {/* School Sidebar (Sticky) */}
                            <td className={`sticky left-0 z-20 border-r border-slate-200/80 p-6 align-middle shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-colors
                                    ${index % 2 === 0 ? 'bg-white/95' : 'bg-slate-50/95'} backdrop-blur-sm
                                `}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-1 h-8 rounded-full ${index % 2 === 0 ? 'bg-indigo-500' : 'bg-purple-500'}`}></div>
                                    <div>
                                        <div className="font-extrabold text-slate-800 text-lg leading-tight tracking-tight">{school.nombre}</div>
                                        <div className="text-xs font-medium text-slate-400 mt-1">ID: {school.id.substring(0, 8)}...</div>
                                    </div>
                                </div>
                            </td>

                            {/* Day Cells */}
                            {DAYS.map(day => {
                                const slots = matrix[school.id][day.id] || []

                                return (
                                    <td key={`${school.id}-${day.id}`} className="border-r border-slate-100 p-3 align-top h-48 relative transition-colors hover:bg-slate-50/50">
                                        {slots.length === 0 ? (
                                            <div className="w-full h-full min-h-[160px] rounded-xl border-2 border-dashed border-slate-100 hover:border-slate-300 group-hover/cell flex flex-col items-center justify-center transition-all cursor-pointer opacity-50 hover:opacity-100">
                                                <Plus className="w-6 h-6 text-slate-300 mb-2" />
                                                <span className="text-xs font-medium text-slate-400">Add Class</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {slots.map(slot => {
                                                    const styleClass = getCardStyle(slot.clase.asignatura.nombre)

                                                    return (
                                                        <div
                                                            key={slot.id}
                                                            onClick={() => onClassClick(slot)}
                                                            className={`relative rounded-xl border-l-[6px] border border-slate-100/50 shadow-sm p-3.5 transition-all duration-200 
                                                                    hover:shadow-lg hover:-translate-y-1 cursor-pointer group/card ${styleClass}`}
                                                        >
                                                            {/* Header: Time Badge */}
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex gap-2">
                                                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/70 backdrop-blur-sm border border-black/5 text-[11px] font-mono font-bold text-slate-500">
                                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                                        {formatTime(slot.clase.horaInicio)} - {formatTime(slot.clase.horaFin)}
                                                                    </div>
                                                                    {slot.clase.edad && (
                                                                        <div className="inline-flex items-center px-2 py-1 rounded-md bg-white/50 backdrop-blur-sm border border-black/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                            {slot.clase.edad}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Subject Title */}
                                                            <h3 className="font-extrabold text-lg leading-tight mb-3 pr-2 tracking-tight">
                                                                {slot.clase.asignatura.nombre}
                                                            </h3>

                                                            {/* Teacher Avatars */}
                                                            <div className="flex flex-col gap-1 pt-2 border-t border-black/5">
                                                                {slot.asignacionesProfesor.length > 0 ? (
                                                                    slot.asignacionesProfesor.map((assign: any) => {
                                                                        const isActive = assign.activo
                                                                        const isSub = assign.origen === 'SUSTITUCION' || assign.tipo === 'TEMPORAL'

                                                                        // INACTIVE (Absent or Moved)
                                                                        if (!isActive) {
                                                                            return (
                                                                                <div key={assign.id} className="flex items-center gap-1.5 opacity-60">
                                                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400 border border-slate-200 line-through decoration-rose-500">
                                                                                        {assign.profesor.nombre.substring(0, 2).toUpperCase()}
                                                                                    </div>
                                                                                    <span className="text-[10px] text-rose-500 font-medium line-through decoration-rose-500/50">
                                                                                        {assign.profesor.nombre}
                                                                                    </span>
                                                                                    <span className="text-[9px] px-1 py-0.5 bg-rose-50 text-rose-600 rounded border border-rose-100 uppercase font-bold tracking-wider">
                                                                                        Absent
                                                                                    </span>
                                                                                </div>
                                                                            )
                                                                        }

                                                                        // ACTIVE (Regular or Sub)
                                                                        return (
                                                                            <div key={assign.id} className="flex items-center gap-1.5">
                                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border shadow-sm
                                                                                    ${isSub
                                                                                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                                                        : 'bg-white text-slate-600 border-slate-100 ring-1 ring-slate-50'}
                                                                                `} title={assign.profesor.nombre}>
                                                                                    {assign.profesor.nombre.substring(0, 2).toUpperCase()}
                                                                                </div>
                                                                                <span className={`text-[11px] font-medium ${isSub ? 'text-blue-700' : 'text-slate-600'}`}>
                                                                                    {assign.profesor.nombre}
                                                                                </span>
                                                                                {isSub && (
                                                                                    <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 uppercase font-bold tracking-wider">
                                                                                        Sub
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })
                                                                ) : (
                                                                    <span className="text-[10px] italic text-amber-500 px-1 font-medium bg-amber-50 rounded-md py-0.5 border border-amber-100">Pending</span>
                                                                )}
                                                            </div>

                                                            {/* Edit Action (Visible on Hover) */}
                                                            <div className="opacity-0 group-hover/card:opacity-100 transition-opacity absolute top-3 right-3">
                                                                <div className="p-1.5 rounded-full hover:bg-black/5 text-slate-400">
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
