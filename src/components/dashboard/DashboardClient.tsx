'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardMatrix from './DashboardMatrix'
import SubstitutionDrawer from './SubstitutionDrawer'
import { Search, Bell, Settings, Menu, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

import IncidenciasPanel from './IncidenciasPanel'

type Props = {
    schools: any[]
    matrix: Record<string, Record<number, any[]>>
    activeWeek: any
    allWeeks: any[]
    currentTeachers?: any
    incidents?: any[]
}

export default function DashboardClient({ schools, matrix, activeWeek, allWeeks, incidents = [] }: Props) {
    const [selectedClass, setSelectedClass] = useState<any>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const router = useRouter()

    const handleClassClick = (claseSemana: any) => {
        setSelectedClass(claseSemana)
        setIsDrawerOpen(true)
    }

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false)
    }

    const changeWeek = (direction: 'next' | 'prev') => {
        const currentIndex = allWeeks.findIndex(w => w.id === activeWeek.id)
        if (currentIndex === -1) return

        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1

        // Bounds check
        if (newIndex >= 0 && newIndex < allWeeks.length) {
            const nextWeek = allWeeks[newIndex]
            router.push(`/dashboard?semanaId=${nextWeek.id}`)
        }
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50/50 font-sans text-slate-900">
            {/* Header */}
            <header className="px-6 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer">
                            <Menu className="w-5 h-5" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard de Clases</h1>
                    </div>

                    {/* Week Navigation */}
                    <div className="flex items-center bg-slate-100/50 rounded-xl p-1 border border-slate-200/60">
                        <button
                            onClick={() => changeWeek('prev')}
                            disabled={allWeeks[0]?.id === activeWeek.id}
                            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2 px-4 border-l border-r border-slate-200/50 h-6">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700 tabular-nums">
                                {new Date(activeWeek.fechaInicio).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                {' - '}
                                {new Date(activeWeek.fechaFin).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                            </span>
                            {activeWeek.activa && (
                                <span className="ml-1 flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => changeWeek('next')}
                            disabled={allWeeks[allWeeks.length - 1]?.id === activeWeek.id}
                            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 mr-2">
                        <Search className="w-4 h-4 text-slate-400 mr-2" />
                        <span className="text-sm text-slate-400">Search schedule...</span>
                    </div>
                    <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                    </button>
                    <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                    <div className="ml-2 w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white cursor-pointer">
                        AD
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col relative">

                {/* Scrollable Matrix + Incidents */}
                <div className="flex-1 overflow-auto bg-slate-50/50 pb-20">
                    <DashboardMatrix
                        schools={schools}
                        matrix={matrix}
                        onClassClick={handleClassClick}
                    />

                    {/* Incidencias Panel - At the bottom of content */}
                    <div className="mt-8 max-w-7xl mx-auto px-4 pb-12">
                        <IncidenciasPanel incidents={incidents} />
                    </div>
                </div>

            </div>

            {/* Drawer */}
            {selectedClass && (
                <SubstitutionDrawer
                    isOpen={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    claseSemana={selectedClass}
                    currentTeachers={selectedClass.asignacionesProfesor}
                />
            )}
        </div>
    )
}
