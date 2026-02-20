import Link from "next/link";
import { Mic, MessageSquare, FileText, ArrowRight, Stethoscope, ShieldCheck } from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8 md:py-16 bg-background">
            <div className="max-w-5xl mx-auto w-full space-y-8 md:space-y-12">
                {/* Header */}
                <div className="text-center space-y-4">
                    <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                        Medical Treatment System
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                        AI-Powered Healthcare
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                        Complete medical workflow from consultation to treatment planning
                        and transcription
                    </p>
                </div>

                {/* Main Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                    {/* Pre-Consultation */}
                    <Link href="/pre-consultation" className="group">
                        <div className="h-full border border-border bg-card p-8 transition-colors hover:bg-card/80 hover:border-muted-foreground/30">
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-3 bg-secondary">
                                    <MessageSquare className="h-6 w-6 text-foreground" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">
                                Pre-Consultation
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                Interactive chatbot for patient intake and medical history
                                collection
                            </p>
                        </div>
                    </Link>

                    {/* Consultation Notes */}
                    <Link href="/consultation-notes" className="group">
                        <div className="h-full border border-border bg-card p-8 transition-colors hover:bg-card/80 hover:border-muted-foreground/30">
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-3 bg-secondary">
                                    <Stethoscope className="h-6 w-6 text-foreground" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">
                                Consultation Notes
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                Generate SOAP notes from medical consultations
                            </p>
                        </div>
                    </Link>

                    {/* Treatment Planner */}
                    <Link href="/treatment-planner" className="group">
                        <div className="h-full border border-border bg-card p-8 transition-colors hover:bg-card/80 hover:border-muted-foreground/30">
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-3 bg-secondary">
                                    <FileText className="h-6 w-6 text-foreground" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">
                                Treatment Planner
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                AI-assisted treatment plan creation with edit workflow
                            </p>
                        </div>
                    </Link>

                    {/* Transcription */}
                    <Link href="/transcription" className="group">
                        <div className="h-full border border-border bg-card p-8 transition-colors hover:bg-card/80 hover:border-muted-foreground/30">
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-3 bg-secondary">
                                    <Mic className="h-6 w-6 text-foreground" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">
                                Transcription
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                Voice recording and AI-powered medical transcription service
                            </p>
                        </div>
                    </Link>

                    {/* Prescription Analyzer */}
                    <Link href="/prescription-analyzer" className="group">
                        <div className="h-full border border-border bg-card p-8 transition-colors hover:bg-card/80 hover:border-muted-foreground/30">
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-3 bg-secondary">
                                    <ShieldCheck className="h-6 w-6 text-foreground" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">
                                Prescription Analyzer
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                Upload a prescription PDF for AI drug interaction and FDA safety analysis
                            </p>
                        </div>
                    </Link>
                </div>

                {/* Footer */}
                <div className="text-center pt-8">
                    <p className="text-xs font-mono text-muted-foreground tracking-widest">
                        POWERED BY DimensionLeap
                    </p>
                </div>
            </div>
        </div>
    );
}
