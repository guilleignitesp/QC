import { useState } from 'react'
import { revertIncidentAction, toggleIncidentAction } from '@/app/actions/substitution'
import { Trash2, Loader2, ArrowRight, Settings, Calendar, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
    incidents: any[]
}

export default function IncidenciasPanel({ incidents }: Props) {
    const [processing, setProcessing] = useState<string | null>(null) // ID being reverted
    const [toggling, setToggling] = useState<string | null>(null) // ID being toggled
    const router = useRouter()

    const handleRevert = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres revertir este cambio?')) return
        setProcessing(id)
        const res = await revertIncidentAction(id)
        if (!res.success) {
            alert('Error al revertir: ' + res.error)
        } else {
            router.refresh()
        }
        setProcessing(null)
    }

    const handleToggle = async (id: string, currentStatus: boolean) => {
        setToggling(id)
        await toggleIncidentAction(id, !currentStatus)
        // No need to alert error, just refresh visually. Optimistic would be better but this is fine.
        router.refresh()
        setToggling(null)
    }

    if (!incidents || incidents.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 mb-4">
                    <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-sm font-medium text-slate-900">Plantilla Original</h3>
                <p className="mt-1 text-sm text-slate-500">No se han detectado cambios en la planificación de esta semana.</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Incidencias de la Semana</h3>
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                    {incidents.length}
                </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {incidents.map((inc) => {
                    const isSubstitution = inc.type === 'SUBSTITUTION'
                    const isRefuerzo = !inc.profesorSaliente && inc.profesorEntrante
                    const isStructural = inc.type === 'STRUCTURAL' || (!inc.profesorSaliente && !inc.profesorEntrante)
                    const isConfirmed = !!inc.confirmed

                    // Always use the main timestamp which is now guaranteed to be the Audit Time (fechaCambio)
                    const displayDate = inc.timestamp
                    const dateObj = displayDate ? new Date(displayDate) : null

                    const time = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
                    const dateStr = dateObj ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''

                    if (!inc.targetClass) return null

                    return (
                        <div key={inc.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-3 group">

                            {/* Confirmation Toggle */}
                            <button
                                onClick={() => handleToggle(inc.id, isConfirmed)}
                                disabled={!!toggling}
                                className={`flex-shrink-0 transition-all p-1 rounded-full ${isConfirmed
                                        ? 'text-emerald-500 opacity-100 hover:bg-emerald-50'
                                        : 'text-slate-400 opacity-100 hover:text-slate-600 hover:bg-slate-100'
                                    }`}
                                title={isConfirmed ? "Confirmado (Click para deshacer)" : "Pendiente de confirmación"}
                            >
                                {toggling === inc.id ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                ) : (
                                    <CheckCircle2
                                        className={`w-5 h-5 ${isConfirmed ? 'fill-emerald-50' : ''}`}
                                    />
                                )}
                            </button>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                            {inc.targetClass.schoolName}
                                            {isStructural && ` - ${inc.targetClass.subjectName}`}
                                        </span>
                                        {isConfirmed && (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                CONFIRMADO
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500" title={`Registrado el ${dateStr} a las ${time}`}>
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        <span>{dateStr}, {time}</span>
                                    </div>
                                </div>

                                {isStructural ? (
                                    // STRUCTURAL CHANGE UI
                                    <div className="flex items-start gap-3 bg-purple-50/50 p-2 rounded-lg border border-purple-100/50">
                                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mt-0.5">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">
                                                Cambio de Configuración
                                            </span>
                                            <div className="text-sm space-y-1">
                                                {inc.motivo && inc.motivo.startsWith('CONFIG:') ? (
                                                    inc.motivo.replace('CONFIG:', '').split('||').map((part: string, idx: number) => {
                                                        const text = part.trim()
                                                        if (text.startsWith('[-]')) {
                                                            return (
                                                                <div key={idx} className="text-rose-600 font-medium flex items-center gap-1.5 bg-rose-50/50 px-2 py-0.5 rounded w-fit">
                                                                    <span className="text-[10px] grid place-content-center w-3 h-3 bg-rose-100 rounded-full font-bold">−</span>
                                                                    {text.replace('[-]', '').trim()} eliminado/a
                                                                </div>
                                                            )
                                                        }
                                                        if (text.startsWith('[+]')) {
                                                            return (
                                                                <div key={idx} className="text-emerald-600 font-medium flex items-center gap-1.5 bg-emerald-50/50 px-2 py-0.5 rounded w-fit">
                                                                    <span className="text-[10px] grid place-content-center w-3 h-3 bg-emerald-100 rounded-full font-bold">+</span>
                                                                    {text.replace('[+]', '').trim()} añadido/a
                                                                </div>
                                                            )
                                                        }
                                                        if (text.startsWith('[MIN]')) {
                                                            return (
                                                                <div key={idx} className="text-purple-900 font-medium flex items-center gap-1.5 bg-purple-100/30 px-2 py-0.5 rounded w-fit">
                                                                    <span className="text-[10px] text-purple-500 font-bold">MIN</span>
                                                                    Mínimo de profesores: {text.replace('[MIN]', '').trim()}
                                                                </div>
                                                            )
                                                        }
                                                        return <div key={idx} className="text-purple-900 font-medium">{text}</div>
                                                    })
                                                ) : (
                                                    <div className="text-purple-900 font-medium">
                                                        {inc.motivo ? inc.motivo : 'Ajustes en la plantilla o mínimos'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // STANDARD SUBSTITUTION / REFUERZO UI
                                    <>
                                        <div className="text-sm flex items-center flex-wrap gap-2 text-slate-800">
                                            {/* Saliente (Only if NOT refuerzo) */}
                                            {inc.profesorSaliente ? (
                                                <span className="font-medium text-rose-500 decoration-rose-300 decoration-1 line-through opacity-75">
                                                    {inc.profesorSaliente.nombre}
                                                </span>
                                            ) : (
                                                isRefuerzo && (
                                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs border border-emerald-100 uppercase tracking-wider">
                                                        REFUERZO
                                                    </span>
                                                )
                                            )}

                                            {/* Arrow */}
                                            <ArrowRight className="w-4 h-4 text-slate-300" />

                                            {/* Entrante */}
                                            {inc.profesorEntrante ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded border border-emerald-100">
                                                        {inc.profesorEntrante.nombre}
                                                    </span>

                                                    {/* Origin Info */}
                                                    {inc.originClass ? (
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            (Viene de <span className="font-medium text-slate-500">{inc.originClass.schoolName}</span>)
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-emerald-500 font-medium ml-1">
                                                            (Libre)
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                                    AUSENTE
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1 pl-0.5">
                                            {inc.targetClass.subjectName}
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => handleRevert(inc.id)}
                                disabled={!!processing}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Revertir operación completa"
                            >
                                {processing === inc.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
