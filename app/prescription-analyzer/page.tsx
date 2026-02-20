"use client";

import { useState, useRef } from "react";
import {
    Upload,
    FileText,
    Loader2,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    Pill,
    ShieldCheck,
    ClipboardList,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/use-toast";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Types matching the backend SafetyReport Pydantic model ──────────────────
type MedicationDetail = {
    name: string;
    dosage: string;
    timing?: string | null;
    doc_noted_warnings?: string | null;
    fda_risk_assessment: string;
};

type SafetyReport = {
    verdict: "SAFE" | "WARNING" | "DANGEROUS";
    medications: MedicationDetail[];
    interaction_summary: string;
    compliance_check: string;
    disclaimer: string;
};

// ── Verdict config ──────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
    SAFE: {
        label: "SAFE",
        icon: CheckCircle,
        className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
        barColor: "bg-emerald-400",
        description: "No significant drug interactions or safety concerns detected.",
    },
    WARNING: {
        label: "WARNING",
        icon: AlertTriangle,
        className: "text-amber-400 bg-amber-400/10 border-amber-400/30",
        barColor: "bg-amber-400",
        description: "Potential drug interactions or concerns detected. Review carefully.",
    },
    DANGEROUS: {
        label: "DANGEROUS",
        icon: XCircle,
        className: "text-red-400 bg-red-400/10 border-red-400/30",
        barColor: "bg-red-500",
        description: "Critical safety risks identified. Immediate physician review required.",
    },
};

// ── MedicationCard ──────────────────────────────────────────────────────────
function MedicationCard({ med, index }: { med: MedicationDetail; index: number }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="border border-border bg-card overflow-hidden">
            <button
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors text-left"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary flex-shrink-0">
                        <Pill className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                        <p className="font-semibold text-foreground text-sm">{med.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                            {med.dosage}
                            {med.timing ? ` · ${med.timing}` : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-border divide-y divide-border">
                    {/* FDA Risk Assessment */}
                    <div className="p-4 space-y-1">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                            FDA Risk Assessment
                        </p>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/80 leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {med.fda_risk_assessment}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Doctor's Notes — only show if present */}
                    {med.doc_noted_warnings && (
                        <div className="p-4 space-y-1 bg-amber-400/5">
                            <p className="text-xs font-mono text-amber-400/80 uppercase tracking-wider mb-2">
                                Doctor's Handwritten Note
                            </p>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                {med.doc_noted_warnings}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PrescriptionAnalyzerPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<SafetyReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const PRESCRIPTION_API =
        process.env.NEXT_PUBLIC_PRESCRIPTION_BACKEND_URL || "http://localhost:8006";

    // ── File helpers ─────────────────────────────────────────────────────────
    const handleFileSelect = (selected: File) => {
        if (!selected.name.toLowerCase().endsWith(".pdf")) {
            toast({ title: "Invalid file", description: "Please upload a PDF file." });
            return;
        }
        setFile(selected);
        setReport(null);
        setError(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFileSelect(dropped);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) handleFileSelect(selected);
    };

    // ── Submit ───────────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!file) return;

        setIsLoading(true);
        setReport(null);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${PRESCRIPTION_API}/process-prescription`, {
                method: "POST",
                body: formData,
                // Do NOT set Content-Type — browser sets multipart boundary automatically
            });

            if (!response.ok) {
                const detail = await response.json().catch(() => ({}));
                throw new Error(detail?.detail || `Server error: ${response.status}`);
            }

            const data: SafetyReport = await response.json();
            setReport(data);
        } catch (err: any) {
            const msg = err?.message || "Failed to analyze prescription";
            setError(msg);
            toast({ title: "Analysis Failed", description: msg });
        } finally {
            setIsLoading(false);
        }
    };

    const verdictCfg = report ? VERDICT_CONFIG[report.verdict] ?? VERDICT_CONFIG.WARNING : null;

    return (
        <div className="min-h-screen bg-background p-4">
            <Toaster />
            <div className="max-w-4xl mx-auto space-y-6 py-8">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Prescription Analyzer
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upload a prescription PDF for AI-powered drug interaction & safety analysis
                        </p>
                    </div>
                    <Link href="/dashboard">
                        <Button variant="outline">Back to Home</Button>
                    </Link>
                </div>

                {/* ── Upload Area ── */}
                <div className="border border-border bg-card p-6 space-y-4">
                    <div
                        className={`border-2 border-dashed transition-colors p-10 text-center cursor-pointer
                            ${isDragging
                                ? "border-primary bg-primary/5"
                                : file
                                    ? "border-primary/40 bg-primary/5"
                                    : "border-border hover:border-muted-foreground/40"
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handleInputChange}
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-3 bg-secondary">
                                    <FileText className="h-8 w-8 text-foreground" />
                                </div>
                                <p className="font-semibold text-foreground">{file.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {(file.size / 1024).toFixed(1)} KB · Click or drag to replace
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-3 bg-secondary">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <p className="text-foreground font-medium">
                                    Drag & drop a prescription PDF
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">or click to browse</p>
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleAnalyze}
                        disabled={!file || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Analyzing Prescription…
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4" />
                                Analyze Prescription
                            </>
                        )}
                    </Button>

                    {/* Processing note */}
                    {isLoading && (
                        <div className="flex items-center gap-2 p-3 bg-secondary text-sm text-muted-foreground">
                            <Info className="h-4 w-4 flex-shrink-0" />
                            <span>
                                Processing may take 30–90 seconds. The AI is extracting medications
                                and querying the FDA database for each drug.
                            </span>
                        </div>
                    )}
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="border border-red-400/30 bg-red-400/5 p-4 flex items-start gap-3">
                        <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-400">Analysis Error</p>
                            <p className="text-sm text-muted-foreground mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* ── Report ── */}
                {report && verdictCfg && (
                    <div className="space-y-5">

                        {/* Verdict Banner */}
                        <div className={`border p-5 flex items-start gap-4 ${verdictCfg.className}`}>
                            <verdictCfg.icon className="h-7 w-7 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-xl font-bold tracking-wider">
                                        {verdictCfg.label}
                                    </p>
                                    <span className="text-xs font-mono px-2 py-1 bg-current/10 border border-current/20">
                                        {report.medications.length} medication{report.medications.length !== 1 ? "s" : ""} analyzed
                                    </span>
                                </div>
                                <p className="text-sm mt-1 opacity-80">{verdictCfg.description}</p>
                            </div>
                        </div>

                        {/* Medications */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Pill className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                                    Medications ({report.medications.length})
                                </h2>
                            </div>
                            <div className="space-y-2">
                                {report.medications.map((med, i) => (
                                    <MedicationCard key={i} med={med} index={i} />
                                ))}
                            </div>
                        </div>

                        {/* Interaction Summary */}
                        <div className="border border-border bg-card p-5 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                                    Drug Interaction Summary
                                </h2>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/80 leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {report.interaction_summary}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Compliance Check */}
                        <div className="border border-border bg-card p-5 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                                    Compliance Audit
                                </h2>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/80 leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {report.compliance_check}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="flex items-start gap-3 p-4 bg-secondary border border-border">
                            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {report.disclaimer}
                            </p>
                        </div>

                        {/* Analyze Another */}
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setReport(null);
                                setFile(null);
                                setError(null);
                            }}
                        >
                            Analyze Another Prescription
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
