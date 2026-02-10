'use client'

import { useState, useEffect } from 'react'
import { getCandidatesAction, applySubstitutionAction } from '@/app/actions/substitution'
import { X, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

type Props = {
    isOpen: boolean
    onClose: () => void
    claseSemana: any
    currentTeachers: any[]
}

export default function SubstitutionDrawer({ isOpen, onClose, claseSemana, currentTeachers }: Props) {
    const [selectedAbsentId, setSelectedAbsentId] = useState<string | null>(null)
    const [candidates, setCandidates] = useState<any | null>(null)
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null) // ID of candidate being applied
    const [success, setSuccess] = useState(false)

    // 1. State Cleanup: Reset when drawer opens or class changes
    useEffect(() => {
        if (!isOpen) {
            // Reset when closed
            setSelectedAbsentId(null)
            setCandidates(null)
            setSuccess(false)
            setLoading(false)
        } else {
            // Also reset if we switch classes while open (edge case, but good safety)
            setSelectedAbsentId(null)
            setCandidates(null)
            setSuccess(false)
            // Keep loading false until they select someone
        }
    }, [isOpen, claseSemana?.id])

    if (!isOpen) return null

    const handleSelectAbsent = async (teacherId: string) => {
        setSelectedAbsentId(teacherId)
        setLoading(true)
        setCandidates(null)

        const res = await getCandidatesAction(claseSemana.id, teacherId)
        if (res.success) {
            setCandidates(res.data)
        } else {
            alert('Error loading candidates')
        }
        setLoading(false)
    }

    const handleApply = async (substituteId: string) => {
        if (!selectedAbsentId) return
        setProcessing(substituteId)

        const res = await applySubstitutionAction(claseSemana.id, selectedAbsentId, substituteId)

        if (res.success) {
            setSuccess(true)

            // Optional: Show a toast or log
            const name = res.teacherName || 'Profesor'
            console.log(`Substitution applied for ${name}`)

            setTimeout(() => {
                onClose() // Ensure drawer closes
                setSuccess(false)
                setSelectedAbsentId(null)
                setCandidates(null)
            }, 1000)
        } else {
            alert('Failed: ' + (res.error || 'Unknown error'))
        }
        setProcessing(null)
    }

    // Helper for rendering candidate lists
    const CandidateList = ({ title, list, color, disabled }: any) => {
        if (!list || list.length === 0) return null
        return (
            <div className={`mb-6 ${disabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{title}</h4>
                <div className="space-y-2">
                    {list.map((item: any) => {
                        // Standardized structure from backend: { teacher, currentClasses: [{ schoolName, subjectName }] }
                        const teacher = item.teacher
                        // Default to empty array if missing (should not be missing with new backend)
                        const classes = item.currentClasses || []

                        let details = 'Descansando'

                        if (classes.length > 0) {
                            details = classes.map((c: any) =>
                                `${c.schoolName.toUpperCase()} - ${c.subjectName}`
                            ).join(' / ')
                        } else {
                            if (disabled) details = 'No disponible' // Or keep Descansando? User didn't specify, but "No disponible" fits Absent.
                            else details = 'Descansando'
                        }

                        // Override details for Absent group if they have no classes shown but are absent
                        if (title.includes('Ausentes')) details = 'Ausente / Movido'

                        return (
                            <div key={teacher.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-600">
                                        {teacher.nombre.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{teacher.nombre}</div>
                                        <div className="text-xs text-slate-500 truncate" title={details}>{details}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        // If critical (P3) and has classes, warn
                                        if (color.includes('amber') && classes.length > 0) {
                                            if (!confirm(`⚠️ ${teacher.nombre} está en ${classes.length} clase(s) crítica(s). ¿Mover de todas formas?`)) return
                                        }
                                        handleApply(teacher.id)
                                    }}
                                    disabled={!!processing || disabled}
                                    className={`flex-shrink-0 px-3 py-1.5 text-white text-xs font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed
                                        ${disabled ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}
                                    `}
                                >
                                    {processing === teacher.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (disabled ? 'N/A' : 'Select')}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-slate-900 mb-1">Find Substitution</h2>
                <p className="text-sm text-slate-500 mb-6">
                    {claseSemana.clase.asignatura.nombre} • {new Date(claseSemana.clase.horaInicio).toLocaleTimeString([], { timeStyle: 'short' })}
                </p>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Changes Saved</h3>
                        <p className="text-slate-500 text-sm">The dashboard has been updated.</p>
                    </div>
                ) : (
                    <>
                        {/* Step 1: Select Absent Teacher */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                                ¿Quién falta?
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {currentTeachers.map((assign: any) => (
                                    <button
                                        key={assign.id}
                                        onClick={() => handleSelectAbsent(assign.profesor.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                     ${selectedAbsentId === assign.profesor.id
                                                ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500'
                                                : 'border-slate-200 hover:border-slate-400 bg-white'}
                                `}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                     ${selectedAbsentId === assign.profesor.id ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'}
                                `}>
                                            {assign.profesor.nombre.substring(0, 2)}
                                        </div>
                                        <span className={`font-medium ${selectedAbsentId === assign.profesor.id ? 'text-rose-900' : 'text-slate-700'}`}>
                                            {assign.profesor.nombre}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 2: Candidates */}
                        {loading && (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        )}

                        {candidates && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="border-t border-slate-100 my-6"></div>
                                <h3 className="text-sm font-bold text-slate-900 mb-4">Available Candidates</h3>

                                <CandidateList
                                    title="Profesores Sobrantes"
                                    list={candidates.priority1_leftover}
                                    color="text-emerald-600"
                                />

                                <CandidateList
                                    title="Fuera de Horario / Libres"
                                    list={candidates.priority2_free}
                                    color="text-slate-500"
                                />

                                <CandidateList
                                    title="Profesores Ocupados (Críticos)"
                                    list={candidates.priority3_creative}
                                    color="text-amber-600"
                                />

                                <CandidateList
                                    title="Profesores Ausentes / Movidos"
                                    list={candidates.priority4_absent}
                                    color="text-rose-400"
                                    disabled={true}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
