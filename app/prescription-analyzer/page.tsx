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
    Home,
    Ban,
    RefreshCw,
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

// "not_prescription" → backend gateway rejected the document (HTTP 422)
// "general"          → any other server / network failure
type ErrorType = "not_prescription" | "general" | null;

// ── Verdict config ──────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
    SAFE: {
        label: "SAFE",
        icon: CheckCircle,
        className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
        description: "No significant drug interactions or safety concerns detected.",
    },
    WARNING: {
        label: "WARNING",
        icon: AlertTriangle,
        className: "text-amber-400 bg-amber-400/10 border-amber-400/30",
        description: "Potential drug interactions or concerns detected. Review carefully.",
    },
    DANGEROUS: {
        label: "DANGEROUS",
        icon: XCircle,
        className: "text-red-400 bg-red-400/10 border-red-400/30",
        description: "Critical safety risks identified. Immediate physician review required.",
    },
};

// ── MedicationCard ──────────────────────────────────────────────────────────
function MedicationCard({ med, index }: { med: MedicationDetail; index: number }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="border border-border bg-card overflow-hidden rounded-sm">
            {/* Header row — always visible, toggles body */}
            <button
                className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-secondary/40 transition-colors text-left"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="p-1.5 sm:p-2 bg-secondary flex-shrink-0">
                        <Pill className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{med.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                            {med.dosage}
                            {med.timing ? ` · ${med.timing}` : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs font-mono text-muted-foreground hidden xs:inline">
                        #{index + 1}
                    </span>
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
                    <div className="p-3 sm:p-4 space-y-1">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                            FDA Risk Assessment
                        </p>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/80 leading-relaxed break-words">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {med.fda_risk_assessment}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Doctor's Notes — only render when present */}
                    {med.doc_noted_warnings && (
                        <div className="p-3 sm:p-4 space-y-1 bg-amber-400/5">
                            <p className="text-xs font-mono text-amber-400/80 uppercase tracking-wider mb-2">
                                Doctor's Handwritten Note
                            </p>
                            <p className="text-sm text-foreground/80 leading-relaxed break-words">
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
    const [file, setFile]             = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading]   = useState(false);
    const [report, setReport]         = useState<SafetyReport | null>(null);

    // errorType distinguishes the gateway "not a prescription" rejection (422)
    // from any other server / network failure so the UI can show the right block.
    const [errorType, setErrorType]   = useState<ErrorType>(null);
    const [errorMsg, setErrorMsg]     = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast }    = useToast();

    const PRESCRIPTION_API =
        process.env.NEXT_PUBLIC_PRESCRIPTION_BACKEND_URL || "http://localhost:8006";

    // ── Helpers ──────────────────────────────────────────────────────────────
    const resetState = () => {
        setReport(null);
        setErrorType(null);
        setErrorMsg(null);
        setFile(null);
    };

    const handleFileSelect = (selected: File) => {
        if (!selected.name.toLowerCase().endsWith(".pdf")) {
            toast({ title: "Invalid file", description: "Please upload a PDF file." });
            return;
        }
        setFile(selected);
        setReport(null);
        setErrorType(null);
        setErrorMsg(null);
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
        setErrorType(null);
        setErrorMsg(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${PRESCRIPTION_API}/process-prescription`, {
                method: "POST",
                body: formData,
                // Do NOT set Content-Type — browser sets multipart/form-data boundary automatically
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                const detail: string = body?.detail || `Server error: ${response.status}`;

                // HTTP 422 is the gateway's rejection code when the document is NOT a prescription.
                // The backend message always contains "not a medical prescription" in that case.
                if (
                    response.status === 422 ||
                    detail.toLowerCase().includes("not a medical prescription") ||
                    detail.toLowerCase().includes("processing terminated")
                ) {
                    setErrorType("not_prescription");
                    setErrorMsg(detail);
                    toast({
                        title: "Not a Prescription",
                        description: "The uploaded document was not recognised as a medical prescription.",
                    });
                } else {
                    setErrorType("general");
                    setErrorMsg(detail);
                    toast({ title: "Analysis Failed", description: detail });
                }
                return;
            }

            const data: SafetyReport = await response.json();
            setReport(data);
        } catch (err: any) {
            // Network-level failure (CORS, offline, etc.)
            const msg = err?.message || "Failed to reach the analysis server.";
            setErrorType("general");
            setErrorMsg(msg);
            toast({ title: "Connection Error", description: msg });
        } finally {
            setIsLoading(false);
        }
    };

    const verdictCfg = report ? VERDICT_CONFIG[report.verdict] ?? VERDICT_CONFIG.WARNING : null;

    return (
        <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
            <Toaster />

            <div className="max-w-4xl mx-auto space-y-5">

                {/* ── Header ── */}
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Prescription Analyzer
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Upload a prescription PDF for AI-powered drug interaction &amp; safety analysis
                        </p>
                    </div>
                    <Link href="/dashboard" className="self-start xs:self-auto flex-shrink-0">
                        <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Home className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Back to Home</span>
                            <span className="sm:hidden">Home</span>
                        </Button>
                    </Link>
                </div>

                {/* ── Upload Area ── */}
                <div className="border border-border bg-card p-4 sm:p-6 space-y-4 rounded-sm">
                    {/* Drop zone */}
                    <div
                        className={`border-2 border-dashed transition-colors p-6 sm:p-10 text-center cursor-pointer rounded-sm
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
                            <div className="flex flex-col items-center gap-2 sm:gap-3">
                                <div className="p-2 sm:p-3 bg-secondary">
                                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-foreground" />
                                </div>
                                <p className="font-semibold text-foreground text-sm sm:text-base break-all px-2">
                                    {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {(file.size / 1024).toFixed(1)} KB · Click or drag to replace
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 sm:gap-3">
                                <div className="p-2 sm:p-3 bg-secondary">
                                    <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                                </div>
                                <p className="text-foreground font-medium text-sm sm:text-base">
                                    Drag &amp; drop a prescription PDF
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">or click to browse</p>
                            </div>
                        )}
                    </div>

                    {/* Analyze button */}
                    <Button
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleAnalyze}
                        disabled={!file || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Analyzing Prescription…</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4" />
                                <span>Analyze Prescription</span>
                            </>
                        )}
                    </Button>

                    {/* Processing info strip */}
                    {isLoading && (
                        <div className="flex items-start gap-2 p-3 bg-secondary text-sm text-muted-foreground rounded-sm">
                            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span className="leading-relaxed">
                                Processing may take 30–90 seconds. The AI first verifies this is a prescription,
                                then extracts medications and queries the FDA database for each drug.
                            </span>
                        </div>
                    )}
                </div>

                {/* ────────────────────────────────────────────────────────────
                    ERROR: Not a Prescription (HTTP 422 gateway rejection)
                    Shown when the AI gateway determines the uploaded document
                    is not a medical prescription.
                ──────────────────────────────────────────────────────────── */}
                {errorType === "not_prescription" && (
                    <div className="border border-orange-400/40 bg-orange-400/5 rounded-sm overflow-hidden">
                        {/* Coloured header bar */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-orange-400/10 border-b border-orange-400/20">
                            <Ban className="h-5 w-5 text-orange-400 flex-shrink-0" />
                            <p className="font-bold text-orange-400 tracking-wide text-sm sm:text-base">
                                NOT A PRESCRIPTION
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:p-5 space-y-4">
                            {/* What happened */}
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                    Document Validation Failed
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    The AI gateway analysed your document and determined it is{" "}
                                    <span className="text-orange-400 font-medium">
                                        not a medical prescription
                                    </span>
                                    . Processing was terminated before the drug-interaction engine ran.
                                </p>
                            </div>


                            {/* What to do */}
                            <div className="space-y-2">
                                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                                    What to do
                                </p>
                                <ul className="space-y-1.5 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 font-bold mt-0.5">·</span>
                                        Ensure the PDF contains a medical prescription issued by a licensed doctor.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 font-bold mt-0.5">·</span>
                                        The document must include drug names, dosages, and a doctor's signature or letterhead.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 font-bold mt-0.5">·</span>
                                        Invoices, lab reports, discharge summaries, or other clinical documents are not accepted.
                                    </li>
                                </ul>
                            </div>

                            {/* CTA */}
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto flex items-center gap-2 border-orange-400/30 text-orange-400 hover:bg-orange-400/10"
                                onClick={resetState}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Try a Different File
                            </Button>
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────────
                    ERROR: General server / network failure
                ──────────────────────────────────────────────────────────── */}
                {errorType === "general" && (
                    <div className="border border-red-400/30 bg-red-400/5 rounded-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border-b border-red-400/20">
                            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                            <p className="font-bold text-red-400 tracking-wide text-sm sm:text-base">
                                ANALYSIS ERROR
                            </p>
                        </div>
                        <div className="p-4 sm:p-5 space-y-3">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                The analysis could not be completed due to a server or network error.
                            </p>
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto flex items-center gap-2"
                                onClick={() => { setErrorType(null); setErrorMsg(null); }}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Success Report ── */}
                {report && verdictCfg && (
                    <div className="space-y-4 sm:space-y-5">

                        {/* Verdict Banner */}
                        <div className={`border rounded-sm p-4 sm:p-5 flex items-start gap-3 sm:gap-4 ${verdictCfg.className}`}>
                            <verdictCfg.icon className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <p className="text-lg sm:text-xl font-bold tracking-wider">
                                        {verdictCfg.label}
                                    </p>
                                    <span className="text-xs font-mono px-2 py-0.5 bg-current/10 border border-current/20">
                                        {report.medications.length}{" "}
                                        medication{report.medications.length !== 1 ? "s" : ""} analyzed
                                    </span>
                                </div>
                                <p className="text-sm mt-1 opacity-80 leading-relaxed">
                                    {verdictCfg.description}
                                </p>
                            </div>
                        </div>

                        {/* Medications */}
                        <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center gap-2">
                                <Pill className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-xs sm:text-sm font-mono text-muted-foreground uppercase tracking-wider">
                                    Medications ({report.medications.length})
                                </h2>
                            </div>
                            <div className="space-y-2">
                                {report.medications.map((med, i) => (
                                    <MedicationCard key={i} med={med} index={i} />
                                ))}
                            </div>
                        </div>

                        {/* Drug Interaction Summary */}
                        <div className="border border-border bg-card rounded-sm p-4 sm:p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <h2 className="text-xs sm:text-sm font-mono text-muted-foreground uppercase tracking-wider">
                                    Drug Interaction Summary
                                </h2>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/80 leading-relaxed break-words">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {report.interaction_summary}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Compliance Audit */}
                        <div className="border border-border bg-card rounded-sm p-4 sm:p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <h2 className="text-xs sm:text-sm font-mono text-muted-foreground uppercase tracking-wider">
                                    Compliance Audit
                                </h2>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/80 leading-relaxed break-words">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {report.compliance_check}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="flex items-start gap-3 p-3 sm:p-4 bg-secondary border border-border rounded-sm">
                            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {report.disclaimer}
                            </p>
                        </div>

                        {/* Analyze Another */}
                        <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                            onClick={resetState}
                        >
                            <RefreshCw className="h-4 w-4" />
                            Analyze Another Prescription
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
