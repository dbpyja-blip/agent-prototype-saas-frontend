"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Home, Upload, FileText, MessageSquare, Stethoscope,
    Loader2, Send, Trash2, RefreshCw, CheckCircle,
    AlertTriangle, XCircle, Lock, User, LogOut,
    ChevronRight, Eye, ArrowLeft, Info, ShieldCheck, Database, Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/use-toast";

// ── Env ──────────────────────────────────────────────────────────────────────
const EMR_API = () =>
    (process.env.NEXT_PUBLIC_EMR_BACKEND_URL ?? "http://localhost:8010").replace(/\/$/, "");

// Transcription backend — shared with pre-consultation voice feature
const TRANSCRIPTION_API = () =>
    (process.env.NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────
interface PatientDoc {
    doc_id: string;
    filename: string;
    doc_type: string;
    timestamp?: string;
    name_match?: boolean;
    extracted_name?: string;
    match_score?: number;
}

interface DocSummary {
    summary: string;
    filename: string;
    doc_type: string;
    name_match?: boolean;
    extracted_name?: string;
    registered_name?: string;
    match_score?: number;
}

interface ChatMsg { role: "user" | "assistant"; content: string; }

// Separate tab types per role so each workspace only ever sees its own tabs
type Role        = "patient" | "doctor" | null;
type PatientTab  = "upload" | "documents" | "patient-chat";
type DoctorTab   = "records" | "doctor-chat";

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function apiPost<T = Record<string, unknown>>(
    endpoint: string, body: unknown, signal?: AbortSignal
): Promise<T | null> {
    try {
        const r = await fetch(`${EMR_API()}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
        });
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error((err as Record<string, string>).detail ?? `HTTP ${r.status}`);
        }
        return r.json();
    } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return null;
        throw e;
    }
}

async function apiGet<T = Record<string, unknown>>(endpoint: string): Promise<T | null> {
    const r = await fetch(`${EMR_API()}${endpoint}`);
    if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).detail ?? `HTTP ${r.status}`);
    }
    return r.json();
}

// ── Shared sub-components ─────────────────────────────────────────────────────

// Generic tab button used in both patient and doctor top bars
function TabBtn({ active, onClick, children }: {
    active: boolean; onClick(): void; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
        >
            {children}
        </button>
    );
}

// ── Shared Markdown renderer ──────────────────────────────────────────────────
// Single source of truth for all markdown rendering in this page.
// Custom component overrides ensure every element (tables, code, headings,
// lists, blockquotes, hr) renders with the correct visual style regardless of
// where it appears — chat bubbles or document summary panels.
function MdContent({ children, className = "" }: { children: string; className?: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className={className}
            components={{
                // ── Headings ─────────────────────────────────────────────
                h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-foreground">{children}</h4>,

                // ── Paragraph ────────────────────────────────────────────
                p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,

                // ── Lists ────────────────────────────────────────────────
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-sm">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,

                // ── Inline styles ────────────────────────────────────────
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-foreground border border-border">
                        {children}
                    </code>
                ),

                // ── Code block ───────────────────────────────────────────
                pre: ({ children }) => (
                    <pre className="my-2 p-3 rounded-lg bg-secondary border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                        {children}
                    </pre>
                ),

                // ── Table (GFM) ──────────────────────────────────────────
                table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm border-collapse">{children}</table>
                    </div>
                ),
                thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
                tr:   ({ children }) => <tr className="divide-x divide-border">{children}</tr>,
                th:   ({ children }) => (
                    <th className="px-3 py-2 text-left text-xs font-semibold text-foreground tracking-wide">
                        {children}
                    </th>
                ),
                td:   ({ children }) => (
                    <td className="px-3 py-2 text-sm text-muted-foreground align-top">
                        {children}
                    </td>
                ),

                // ── Blockquote ───────────────────────────────────────────
                blockquote: ({ children }) => (
                    <blockquote className="my-2 pl-3 border-l-4 border-primary/40 text-muted-foreground italic text-sm">
                        {children}
                    </blockquote>
                ),

                // ── Horizontal rule ──────────────────────────────────────
                hr: () => <hr className="my-3 border-border" />,

                // ── Links ────────────────────────────────────────────────
                a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 hover:opacity-80">
                        {children}
                    </a>
                ),
            }}
        >
            {children}
        </ReactMarkdown>
    );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
// User messages: plain coloured bubble.
// AI messages: card bubble with full MdContent rendering — no prose class wrapper
// so Tailwind's prose plugin never fights with our custom component overrides.
function Bubble({ msg, aiLabel = "MedRecord AI" }: { msg: ChatMsg; aiLabel?: string; }) {
    const isUser = msg.role === "user";
    return (
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1`}>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1">
                {isUser ? "You" : aiLabel}
            </span>
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3
                ${isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm text-sm leading-relaxed"
                    : "bg-card border border-border rounded-tl-sm text-foreground"}`}
            >
                {isUser
                    ? <p>{msg.content}</p>
                    : <MdContent>{msg.content}</MdContent>
                }
            </div>
        </div>
    );
}

// Name-match badge (documents list)
function MatchBadge({ match, extracted }: { match?: boolean; extracted?: string }) {
    if (!extracted) return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
            Name not detected
        </span>
    );
    if (match) return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1 w-fit">
            <CheckCircle className="h-3 w-3" /> Verified
        </span>
    );
    return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1 w-fit">
            <AlertTriangle className="h-3 w-3" /> Name mismatch
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EMRPage() {
    const { toast } = useToast();

    // ── Role selection ──────────────────────────────────────────────────────
    // null  = landing / role-selection screen
    // "patient" = patient flow
    // "doctor"  = doctor flow
    const [role, setRole] = useState<Role>(null);

    // ── Patient session ─────────────────────────────────────────────────────
    const [registered, setRegistered]   = useState(false);
    const [patientId, setPatientId]     = useState("");
    const [patientName, setPatientName] = useState("");
    const [patientTab, setPatientTab]   = useState<PatientTab>("upload");
    const [patientChat, setPatientChat] = useState<ChatMsg[]>([]);

    // ── Doctor session ──────────────────────────────────────────────────────
    const [doctorAuth, setDoctorAuth]               = useState(false);
    const [doctorPatientId, setDoctorPatientId]     = useState("");
    const [doctorPatientName, setDoctorPatientName] = useState("");
    const [doctorTab, setDoctorTab]                 = useState<DoctorTab>("records");
    const [doctorChat, setDoctorChat]               = useState<ChatMsg[]>([]);

    // ── Shared state ────────────────────────────────────────────────────────
    const [documents, setDocuments]         = useState<PatientDoc[]>([]);
    const [summaryDoc, setSummaryDoc]       = useState<DocSummary | null>(null);
    const [viewingDocId, setViewingDocId]   = useState<string | null>(null);

    // ── Loading states ──────────────────────────────────────────────────────
    const [regLoading, setRegLoading]           = useState(false);
    const [uploadLoading, setUploadLoading]     = useState(false);
    const [chatLoading, setChatLoading]         = useState(false);
    const [docLoading, setDocLoading]           = useState(false);
    const [summaryLoading, setSummaryLoading]   = useState(false);
    const [docAuthLoading, setDocAuthLoading]   = useState(false);

    // ── Form state ──────────────────────────────────────────────────────────
    const [regName, setRegName]                     = useState("");
    const [isDragging, setIsDragging]               = useState(false);
    const [uploadFiles, setUploadFiles]             = useState<File[]>([]);
    const [patientInput, setPatientInput]           = useState("");
    const [doctorInput, setDoctorInput]             = useState("");
    const [docPatientSearch, setDocPatientSearch]   = useState("");
    // Doctor's own name — sent to the AI so it can greet by name
    const [doctorOwnName, setDoctorOwnName]         = useState("");
    // Flat list of all registered patients fetched from /api/patients/list
    const [patientList, setPatientList]             = useState<Array<{ patient_id: string; name: string; doc_count: number }>>([]);
    // The patient_id selected from the dropdown (empty = none chosen yet)
    const [selectedPatientId, setSelectedPatientId] = useState("");

    const fileInputRef   = useRef<HTMLInputElement>(null);
    const chatBottomRef  = useRef<HTMLDivElement>(null);
    const dChatBottomRef = useRef<HTMLDivElement>(null);

    // ── Mic / voice recording state ─────────────────────────────────────────
    // Separate recording state for patient vs doctor chats so neither bleeds into the other
    const [isPatientRecording, setIsPatientRecording] = useState(false);
    const [isDoctorRecording,  setIsDoctorRecording]  = useState(false);

    // MediaRecorder refs — one per chat so they don't share state
    const patientMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const doctorMediaRecorderRef  = useRef<MediaRecorder | null>(null);

    // Raw audio chunks accumulated while recording
    const patientChunksRef = useRef<Blob[]>([]);
    const doctorChunksRef  = useRef<Blob[]>([]);

    // Auto-scroll chats when new messages arrive
    useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [patientChat]);
    useEffect(() => { dChatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [doctorChat]);

    // ── API helpers ─────────────────────────────────────────────────────────

    // Fetch all registered patients once so the doctor dropdown is populated.
    // Called when the doctor entry screen is shown (role === "doctor" && !doctorAuth).
    const loadPatientList = async () => {
        try {
            const data = await apiGet<{ patients: Array<{ patient_id: string; name: string; doc_count: number }> }>("/api/patients/list");
            setPatientList(data?.patients ?? []);
        } catch {
            // Non-fatal — doctor can still type manually if the list fails to load
        }
    };

    // Reload patient list whenever we enter the doctor entry screen
    useEffect(() => {
        if (role === "doctor" && !doctorAuth) {
            loadPatientList();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, doctorAuth]);

    // pid defaults to patient's own id; doctor passes doctorPatientId explicitly
    const loadDocuments = async (pid: string) => {
        if (!pid) return;
        setDocLoading(true);
        try {
            const data = await apiGet<{ documents: PatientDoc[] }>(`/api/documents/${pid}`);
            setDocuments(data?.documents ?? []);
        } catch (e: unknown) {
            toast({ title: "Could not load documents", description: e instanceof Error ? e.message : "" });
        } finally {
            setDocLoading(false);
        }
    };

    // ── Patient: register ───────────────────────────────────────────────────
    const handleRegister = async () => {
        if (regName.trim().length < 2) {
            toast({ title: "Enter your full name (at least 2 characters)" });
            return;
        }
        setRegLoading(true);
        try {
            const res = await apiPost<{ patient_id: string; name: string; is_new: boolean }>(
                "/api/patients/register", { name: regName.trim() }
            );
            if (!res) return;
            setPatientId(res.patient_id);
            setPatientName(res.name);
            setRegistered(true);
            setPatientTab("upload");
            await loadDocuments(res.patient_id);
            toast({ title: res.is_new ? `Welcome, ${res.name}!` : `Welcome back, ${res.name}!` });
        } catch (e: unknown) {
            toast({ title: "Registration failed", description: e instanceof Error ? e.message : "" });
        } finally {
            setRegLoading(false);
        }
    };

    // ── Patient: file upload ────────────────────────────────────────────────
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const allowed = ["pdf", "png", "jpg", "jpeg", "tiff", "tif", "bmp", "webp"];
        const valid = Array.from(e.dataTransfer.files).filter(f =>
            allowed.some(ext => f.name.toLowerCase().endsWith(ext))
        );
        setUploadFiles(prev => [...prev, ...valid]);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setUploadFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    };

    const handleUpload = async () => {
        if (!uploadFiles.length) return;
        setUploadLoading(true);
        try {
            const form = new FormData();
            uploadFiles.forEach(f => form.append("files", f));
            form.append("patient_id", patientId);
            form.append("registered_name", patientName);

            const r = await fetch(`${EMR_API()}/api/documents/upload`, { method: "POST", body: form });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data: {
                results: Array<{
                    filename: string; status: string; message?: string;
                    name_match?: boolean; extracted_name?: string;
                    doc_type?: string; match_score?: number;
                }>;
            } = await r.json();

            const ok  = data.results.filter(x => x.status === "success").length;
            const bad = data.results.length - ok;
            toast({ title: `${ok} document(s) processed${bad ? `, ${bad} failed` : ""}` });

            // Warn about name mismatches per file
            data.results.forEach(r => {
                if (r.status === "success" && r.extracted_name && !r.name_match) {
                    toast({
                        title: `Name mismatch in "${r.filename}"`,
                        description: `Document patient: ${r.extracted_name} — may not belong to you.`,
                    });
                }
            });

            setUploadFiles([]);
            await loadDocuments(patientId);
        } catch (e: unknown) {
            toast({ title: "Upload failed", description: e instanceof Error ? e.message : "" });
        } finally {
            setUploadLoading(false);
        }
    };

    // ── Document summary (used by both patient and doctor views) ────────────
    // pid is the patient whose summary to fetch — differs between roles
    const handleViewSummary = async (docId: string, pid: string) => {
        setViewingDocId(docId);
        setSummaryLoading(true);
        setSummaryDoc(null);
        try {
            const data = await apiGet<DocSummary>(`/api/documents/${pid}/${docId}/summary`);
            if (data) {
                // Strip the backend-appended extraction metadata block.
                // The AI wraps it in a fenced code block:
                //   ```
                //   PATIENT_NAME_EXTRACTED: ...
                //   DOCUMENT_TYPE: ...
                //   ```
                // We cut from the last ``` that precedes PATIENT_NAME_EXTRACTED
                // (to remove the opening fence too), then fall back to cutting
                // from PATIENT_NAME_EXTRACTED itself, then trim any stray
                // trailing backticks or whitespace.
                if (data.summary?.includes("PATIENT_NAME_EXTRACTED:")) {
                    const metaIdx = data.summary.lastIndexOf("PATIENT_NAME_EXTRACTED:");
                    // Walk back past whitespace to find the opening code fence
                    const beforeMeta = data.summary.slice(0, metaIdx).trimEnd();
                    const cutPoint = beforeMeta.endsWith("```")
                        ? beforeMeta.length - 3   // remove the opening ``` too
                        : metaIdx;                 // fallback: just cut at the text
                    data.summary = data.summary
                        .slice(0, cutPoint)
                        .trimEnd()
                        // safety net: remove any remaining trailing backtick fence
                        .replace(/`{1,3}\s*$/, "")
                        .trimEnd();
                }
                setSummaryDoc(data);
            }
        } catch (e: unknown) {
            toast({ title: "Could not load summary", description: e instanceof Error ? e.message : "" });
        } finally {
            setSummaryLoading(false);
        }
    };

    // ── Patient: chat ───────────────────────────────────────────────────────
    const sendPatientMessage = async () => {
        const msg = patientInput.trim();
        if (!msg || chatLoading) return;
        const next: ChatMsg[] = [...patientChat, { role: "user", content: msg }];
        setPatientChat(next);
        setPatientInput("");
        setChatLoading(true);
        try {
            const res = await apiPost<{ response: string }>("/api/chat/patient", {
                patient_id: patientId,
                message: msg,
                conversation_history: patientChat,
            });
            if (res?.response)
                setPatientChat(prev => [...prev, { role: "assistant", content: res.response }]);
        } catch (e: unknown) {
            toast({ title: "Chat error", description: e instanceof Error ? e.message : "" });
        } finally {
            setChatLoading(false);
        }
    };

    // ── Doctor: auth ────────────────────────────────────────────────────────
    const handleDoctorAuth = async () => {
        if (!doctorOwnName.trim()) {
            toast({ title: "Please enter your name" });
            return;
        }
        if (!selectedPatientId) {
            toast({ title: "Please select a patient from the dropdown" });
            return;
        }

        // Patient was selected directly from the DB-backed dropdown — no fuzzy search needed
        const selected = patientList.find(p => p.patient_id === selectedPatientId);
        if (!selected) {
            toast({ title: "Selected patient not found, please refresh" });
            return;
        }
        if (selected.doc_count === 0) {
            toast({ title: `${selected.name} has no documents yet` });
            return;
        }

        setDocAuthLoading(true);
        try {
            setDoctorPatientId(selected.patient_id);
            setDoctorPatientName(selected.name);
            setDoctorAuth(true);
            setDoctorTab("records");
            await loadDocuments(selected.patient_id);
        } catch (e: unknown) {
            toast({ title: "Could not load patient records", description: e instanceof Error ? e.message : "" });
        } finally {
            setDocAuthLoading(false);
        }
    };

    // ── Doctor: chat ────────────────────────────────────────────────────────
    const sendDoctorMessage = async () => {
        const msg = doctorInput.trim();
        if (!msg || chatLoading) return;
        const next: ChatMsg[] = [...doctorChat, { role: "user", content: msg }];
        setDoctorChat(next);
        setDoctorInput("");
        setChatLoading(true);
        try {
            const res = await apiPost<{ response: string }>("/api/chat/doctor", {
                patient_id: doctorPatientId,
                message: msg,
                conversation_history: doctorChat,
                // Pass the doctor's name so the AI addresses them personally
                doctor_name: doctorOwnName.trim(),
            });
            if (res?.response)
                setDoctorChat(prev => [...prev, { role: "assistant", content: res.response }]);
        } catch (e: unknown) {
            toast({ title: "Chat error", description: e instanceof Error ? e.message : "" });
        } finally {
            setChatLoading(false);
        }
    };

    // ── Voice helpers: shared transcription flow ────────────────────────────
    // Sends an audio blob to the transcription endpoint and returns the text.
    // Returns "" on any failure so callers can decide whether to set input or skip.
    const transcribeAudio = async (blob: Blob): Promise<string> => {
        try {
            const formData = new FormData();
            formData.append("file", new File([blob], "recording.webm", { type: "audio/webm" }));
            const resp = await fetch(`${TRANSCRIPTION_API()}/transcription`, { method: "POST", body: formData });
            if (!resp.ok) throw new Error("Transcription failed");
            const data = await resp.json();
            return (data.transcription as string) || "";
        } catch {
            toast({ title: "Transcription error", description: "Could not transcribe audio — please type instead." });
            return "";
        }
    };

    // ── Patient chat: mic start / stop ───────────────────────────────────────
    const startPatientRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            patientMediaRecorderRef.current = recorder;
            patientChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) patientChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                // Stop all mic tracks so the browser indicator disappears
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(patientChunksRef.current, { type: "audio/webm" });
                const text = await transcribeAudio(blob);
                if (text) {
                    // Populate the input so the user sees what was transcribed and can edit / confirm
                    setPatientInput(text);
                }
            };

            recorder.start();
            setIsPatientRecording(true);
            toast({ title: "Recording…", description: "Speak your question, then click the mic again to stop." });
        } catch {
            toast({ title: "Microphone error", description: "Could not access microphone — please check browser permissions." });
        }
    };

    const stopPatientRecording = () => {
        if (patientMediaRecorderRef.current && isPatientRecording) {
            patientMediaRecorderRef.current.stop();
            setIsPatientRecording(false);
        }
    };

    // ── Doctor chat: mic start / stop ────────────────────────────────────────
    const startDoctorRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            doctorMediaRecorderRef.current = recorder;
            doctorChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) doctorChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(doctorChunksRef.current, { type: "audio/webm" });
                const text = await transcribeAudio(blob);
                if (text) {
                    setDoctorInput(text);
                }
            };

            recorder.start();
            setIsDoctorRecording(true);
            toast({ title: "Recording…", description: "Speak your query, then click the mic again to stop." });
        } catch {
            toast({ title: "Microphone error", description: "Could not access microphone — please check browser permissions." });
        }
    };

    const stopDoctorRecording = () => {
        if (doctorMediaRecorderRef.current && isDoctorRecording) {
            doctorMediaRecorderRef.current.stop();
            setIsDoctorRecording(false);
        }
    };

    // ── Sign out: always resets back to the role-selection screen ───────────
    const signOut = () => {
        setRole(null);
        setRegistered(false);   setPatientId("");       setPatientName("");
        setPatientTab("upload");setPatientChat([]);
        setDoctorAuth(false);   setDoctorPatientId(""); setDoctorPatientName("");
        setDoctorTab("records");setDoctorChat([]);
        setDocuments([]);       setSummaryDoc(null);    setViewingDocId(null);
        setRegName("");         setDocPatientSearch("");
        setDoctorOwnName("");   setSelectedPatientId(""); setPatientList([]);
        setUploadFiles([]);
    };

    const hasDocs = documents.length > 0;

    // ════════════════════════════════════════════════════════════════════════
    // SCREEN 1 — ROLE SELECTION (2 big cards)
    // ════════════════════════════════════════════════════════════════════════
    if (!role) {
        return (
            <div className="min-h-[calc(100vh-80px)] bg-background px-4 py-8 sm:px-6">
                <Toaster />
                <div className="max-w-2xl mx-auto w-full space-y-8">

                    {/* Header row — title left, Back to Home right (same pattern as all other pages) */}
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                                <Database className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">EMR MedRead</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                    Select your role to continue
                                </p>
                            </div>
                        </div>
                        <Link href="/dashboard" className="self-start xs:self-auto flex-shrink-0">
                            <Button variant="outline" size="sm" className="whitespace-nowrap">
                                <Home className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Back to Home</span>
                                <span className="sm:hidden">Home</span>
                            </Button>
                        </Link>
                    </div>

                    {/* Role cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                        {/* ── Patient card ── */}
                        <button
                            onClick={() => setRole("patient")}
                            className="group text-left border border-border bg-card rounded-2xl p-6 hover:border-primary/40 hover:shadow-md hover:-translate-y-1 transition-all space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                            <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors">
                                <User className="h-7 w-7" />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="text-xl font-semibold text-foreground">Patient Portal</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Upload your medical records, get AI-powered summaries, and ask questions about your health in plain language.
                                </p>
                            </div>
                            {/* Feature list */}
                            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                {["Upload documents (PDF, scans, X-rays)", "AI-generated summaries", "Chat with your records"].map(f => (
                                    <span key={f} className="flex items-center gap-1.5">
                                        <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" /> {f}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-1 text-sm font-medium text-primary">
                                Enter as Patient <ChevronRight className="h-4 w-4" />
                            </div>
                        </button>

                        {/* ── Doctor card ── */}
                        <button
                            onClick={() => setRole("doctor")}
                            className="group text-left border border-border bg-card rounded-2xl p-6 hover:border-emerald-500/40 hover:shadow-md hover:-translate-y-1 transition-all space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                        >
                            <div className="h-14 w-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500/15 transition-colors">
                                <Stethoscope className="h-7 w-7" />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="text-xl font-semibold text-foreground">Doctor Portal</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Securely access patient records with your clinical access code and get AI-assisted clinical insights.
                                </p>
                            </div>
                            {/* Feature list */}
                            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                {["Secure access code login", "Review patient documents", "AI clinical analysis & chat"].map(f => (
                                    <span key={f} className="flex items-center gap-1.5">
                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" /> {f}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                                Enter as Doctor <ChevronRight className="h-4 w-4" />
                            </div>
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCREEN 2A — PATIENT ENTRY FORM
    // ════════════════════════════════════════════════════════════════════════
    if (role === "patient" && !registered) {
        return (
            <div className="min-h-[calc(100vh-80px)] bg-background px-4 py-8 sm:px-6">
                <Toaster />
                <div className="max-w-md mx-auto w-full space-y-6">

                    {/* Header row — same responsive pattern as all other pages */}
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Patient Portal</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Enter your name to access your records</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setRole(null)}
                            className="self-start xs:self-auto flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-secondary transition-colors whitespace-nowrap"
                        >
                            <ArrowLeft className="h-4 w-4 sm:mr-0.5" />
                            <span className="hidden sm:inline">Back</span>
                        </button>
                    </div>

                    {/* Form card */}
                    <div className="border border-border bg-card rounded-xl p-5 sm:p-6 space-y-4">
                        <p className="text-sm text-muted-foreground">
                            First time? A new workspace will be created for you. Returning? Your documents will load automatically.
                        </p>
                        <input
                            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="Your full name — e.g. John Michael Smith"
                            value={regName}
                            onChange={e => setRegName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleRegister()}
                            autoFocus
                        />
                        <Button className="w-full gap-2" onClick={handleRegister} disabled={regLoading}>
                            {regLoading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up workspace…</>
                                : <>Access My Records <ChevronRight className="h-4 w-4" /></>
                            }
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCREEN 2B — DOCTOR ENTRY FORM
    // ════════════════════════════════════════════════════════════════════════
    if (role === "doctor" && !doctorAuth) {
        return (
            <div className="min-h-[calc(100vh-80px)] bg-background px-4 py-8 sm:px-6">
                <Toaster />
                <div className="max-w-md mx-auto w-full space-y-6">

                    {/* Header row — same responsive pattern as all other pages */}
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                                <Stethoscope className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Doctor Portal</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Secure clinical access to patient records</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setRole(null)}
                            className="self-start xs:self-auto flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-secondary transition-colors whitespace-nowrap"
                        >
                            <ArrowLeft className="h-4 w-4 sm:mr-0.5" />
                            <span className="hidden sm:inline">Back</span>
                        </button>
                    </div>

                    {/* Form card */}
                    <div className="border border-border bg-card rounded-xl p-5 sm:p-6 space-y-4">

                        {/* Doctor's own name — used by AI to address them personally */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Your name</label>
                            <input
                                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                placeholder="e.g. Sarah Mitchell"
                                value={doctorOwnName}
                                onChange={e => setDoctorOwnName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Patient selector — dropdown populated from the DB */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Select patient</label>
                            {patientList.length === 0 ? (
                                /* Loading / empty state — show a disabled placeholder */
                                <div className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                                    Loading patients…
                                </div>
                            ) : (
                                <select
                                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                                    value={selectedPatientId}
                                    onChange={e => setSelectedPatientId(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleDoctorAuth()}
                                >
                                    <option value="" disabled>— choose a patient —</option>
                                    {patientList.map(p => (
                                        <option key={p.patient_id} value={p.patient_id}>
                                            {p.name}{p.doc_count > 0 ? ` (${p.doc_count} doc${p.doc_count !== 1 ? "s" : ""})` : " · no docs"}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            className="w-full gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/5 hover:border-emerald-500/50"
                            onClick={handleDoctorAuth}
                            disabled={docAuthLoading}
                        >
                            {docAuthLoading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                                : <>Access Patient Records <ChevronRight className="h-4 w-4" /></>
                            }
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCREEN 3A — PATIENT WORKSPACE
    // Tabs: Upload | Documents | Patient Chat  (NO Doctor Chat here)
    // ════════════════════════════════════════════════════════════════════════
    if (role === "patient" && registered) {
        return (
            <div className="min-h-screen bg-background">
                <Toaster />

                {/* ── Top bar ── */}
                <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <Link href="/dashboard">
                                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                                    <Home className="h-4 w-4" />
                                    <span className="hidden sm:inline">Dashboard</span>
                                </Button>
                            </Link>
                            <span className="text-border">|</span>
                            {/* Patient identity badge */}
                            <span className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 truncate max-w-[140px] sm:max-w-none">
                                <User className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{patientName}</span>
                            </span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                {documents.length} document{documents.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <Button
                            variant="ghost" size="sm"
                            className="gap-1.5 text-muted-foreground flex-shrink-0"
                            onClick={signOut}
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Sign Out</span>
                        </Button>
                    </div>

                    {/* Patient tab bar — Upload / Documents / Patient Chat */}
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 overflow-x-auto">
                        <div className="flex min-w-max">
                            <TabBtn active={patientTab === "upload"} onClick={() => setPatientTab("upload")}>
                                <Upload className="h-3.5 w-3.5" /> Upload
                            </TabBtn>
                            <TabBtn active={patientTab === "documents"} onClick={() => setPatientTab("documents")}>
                                <FileText className="h-3.5 w-3.5" />
                                Documents {documents.length > 0 && `(${documents.length})`}
                            </TabBtn>
                            <TabBtn active={patientTab === "patient-chat"} onClick={() => setPatientTab("patient-chat")}>
                                {hasDocs
                                    ? <MessageSquare className="h-3.5 w-3.5" />
                                    : <Lock className="h-3.5 w-3.5" />}
                                My Health Chat
                            </TabBtn>
                        </div>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

                    {/* ── Upload tab ── */}
                    {patientTab === "upload" && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Upload Medical Documents</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    PDF, PNG, JPG, TIFF, BMP, WebP — prescriptions, blood reports, CT scans, X-rays, lab reports
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                {/* Drop zone */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors
                                            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleFileDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef} type="file" multiple
                                            accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
                                            className="hidden"
                                            onChange={handleFileInput}
                                        />
                                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                        <p className="font-medium text-foreground text-sm">Drag & drop medical documents here</p>
                                        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                                    </div>

                                    {/* Queued file list */}
                                    {uploadFiles.length > 0 && (
                                        <div className="space-y-2">
                                            {uploadFiles.map((f, i) => (
                                                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 bg-secondary rounded-lg border border-border text-sm">
                                                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                    <span className="flex-1 truncate text-foreground">{f.name}</span>
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                                                    <button
                                                        onClick={() => setUploadFiles(prev => prev.filter((_, j) => j !== i))}
                                                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <Button className="w-full gap-2" onClick={handleUpload} disabled={uploadLoading}>
                                                {uploadLoading
                                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> AI is analysing documents… (1–3 min per file)</>
                                                    : <><ShieldCheck className="h-4 w-4" /> Process {uploadFiles.length} Document{uploadFiles.length > 1 ? "s" : ""} with AI</>
                                                }
                                            </Button>
                                            {uploadLoading && (
                                                <div className="flex items-start gap-2 p-3 bg-secondary rounded-lg border border-border text-xs text-muted-foreground">
                                                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                                    OCR extraction + AI summarisation can take 1–3 minutes per document.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Supported types sidebar */}
                                <div className="border border-border bg-card rounded-xl p-5 space-y-3 h-fit">
                                    <p className="font-semibold text-sm text-foreground">Supported Document Types</p>
                                    {[
                                        "Prescriptions", "Blood Reports", "CT Scans / X-Rays",
                                        "Discharge Summaries", "Medication Lists", "Lab Reports", "Medical Records",
                                    ].map(t => (
                                        <div key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Documents tab ── */}
                    {patientTab === "documents" && (
                        <div className="space-y-5">

                            {/* Summary detail view */}
                            {viewingDocId ? (
                                <div className="space-y-4">
                                    <button
                                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => { setViewingDocId(null); setSummaryDoc(null); }}
                                    >
                                        <ArrowLeft className="h-4 w-4" /> Back to My Documents
                                    </button>

                                    {summaryLoading && (
                                        <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                                            <Loader2 className="h-5 w-5 animate-spin" /> Loading AI summary…
                                        </div>
                                    )}

                                    {summaryDoc && (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h2 className="text-lg font-semibold text-foreground">{summaryDoc.filename}</h2>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                                                    {summaryDoc.doc_type}
                                                </span>
                                                <MatchBadge match={summaryDoc.name_match} extracted={summaryDoc.extracted_name} />
                                            </div>
                                            {summaryDoc.extracted_name && !summaryDoc.name_match && (
                                                <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                    <div className="space-y-0.5">
                                                        <p className="font-semibold text-amber-600">Name Mismatch Detected</p>
                                                        <p className="text-muted-foreground">
                                                            Registered: <strong>{summaryDoc.registered_name}</strong> · Document: <strong>{summaryDoc.extracted_name}</strong>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Wrapper handles scroll/overflow; MdContent handles all typography */}
                                            <div className="border border-border bg-card rounded-xl p-5 overflow-y-auto max-h-[60vh] break-words">
                                                <MdContent>{summaryDoc.summary}</MdContent>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Document list */
                                <>
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-foreground">My Documents</h2>
                                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => loadDocuments(patientId)} disabled={docLoading}>
                                            {docLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                            Refresh
                                        </Button>
                                    </div>

                                    {docLoading && (
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground p-4">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
                                        </div>
                                    )}

                                    {!docLoading && documents.length === 0 && (
                                        <div className="text-center py-16 space-y-2">
                                            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                                            <p className="text-muted-foreground text-sm">No documents yet — upload some in the Upload tab.</p>
                                            <Button variant="outline" size="sm" onClick={() => setPatientTab("upload")}>Go to Upload</Button>
                                        </div>
                                    )}

                                    {!docLoading && documents.length > 0 && (
                                        <div className="space-y-3">
                                            {documents.map(doc => (
                                                <div
                                                    key={doc.doc_id}
                                                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-xl bg-card transition-colors
                                                        ${doc.extracted_name && !doc.name_match ? "border-amber-500/30" : "border-border"}`}
                                                >
                                                    <FileText className={`h-5 w-5 flex-shrink-0 ${doc.extracted_name && !doc.name_match ? "text-amber-500" : "text-muted-foreground"}`} />
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <p className="font-medium text-sm text-foreground truncate">{doc.filename}</p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-xs text-muted-foreground">{doc.doc_type}</span>
                                                            {doc.timestamp && <span className="text-xs text-muted-foreground">{doc.timestamp.slice(0, 16)}</span>}
                                                            <MatchBadge match={doc.name_match} extracted={doc.extracted_name} />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline" size="sm" className="gap-1.5 flex-shrink-0"
                                                        onClick={() => handleViewSummary(doc.doc_id, patientId)}
                                                    >
                                                        <Eye className="h-3.5 w-3.5" /> Summary
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Patient Chat tab ── */}
                    {patientTab === "patient-chat" && (
                        <div className="space-y-4">
                            {!hasDocs ? (
                                <div className="text-center py-16 space-y-3">
                                    <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                                    <p className="font-medium text-foreground">Chat locked</p>
                                    <p className="text-sm text-muted-foreground">Upload your medical documents first to enable AI chat.</p>
                                    <Button variant="outline" size="sm" onClick={() => setPatientTab("upload")}>Go to Upload</Button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-foreground">My Health Chat</h2>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Ask anything about your {documents.length} medical document{documents.length !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        {patientChat.length > 0 && (
                                            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setPatientChat([])}>
                                                <Trash2 className="h-3.5 w-3.5" /> Clear
                                            </Button>
                                        )}
                                    </div>

                                    {/* Fixed-height chat window with internal scroll — same UX as pre-consultation */}
                                    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-background">

                                        {/* Messages area: scrolls internally, input bar stays pinned at bottom */}
                                        <div className="h-[50vh] md:h-[420px] overflow-y-auto p-4 space-y-4">
                                            {patientChat.map((m, i) => <Bubble key={i} msg={m} />)}
                                            {chatLoading && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing your records…
                                                </div>
                                            )}
                                            <div ref={chatBottomRef} />
                                        </div>

                                        {/* Suggestion chips: horizontal scrollable pill row above the input bar.
                                            Only shown when chat is empty — vanish automatically after the first message. */}
                                        {patientChat.length === 0 && (
                                            <div className="border-t border-border px-3 py-2 flex flex-row gap-2 overflow-x-auto scrollbar-none">
                                                {[
                                                    "What medications am I currently taking?",
                                                    "Summarise my recent blood test results",
                                                    "What are my key diagnoses?",
                                                    "Do I have any abnormal values in my reports?",
                                                ].map(s => (
                                                    <button key={s} onClick={() => setPatientInput(s)}
                                                        className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                                                    >{s}</button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Sticky input bar — border-t visually separates it from messages / chips */}
                                        <div className="border-t border-border p-3 bg-background">
                                            <div className="flex items-center gap-2">
                                                {/* Mic button: active state pulses to show recording is live */}
                                                <Button
                                                    variant={isPatientRecording ? "default" : "outline"}
                                                    size="icon"
                                                    type="button"
                                                    className="h-10 w-10 flex-shrink-0"
                                                    onClick={isPatientRecording ? stopPatientRecording : startPatientRecording}
                                                    disabled={chatLoading}
                                                    title={isPatientRecording ? "Stop recording" : "Start voice input"}
                                                >
                                                    <Mic className={`h-4 w-4 ${isPatientRecording ? "animate-pulse" : ""}`} />
                                                </Button>

                                                <input
                                                    className="flex-1 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    placeholder="Ask about your medications, test results, diagnoses…"
                                                    value={patientInput}
                                                    onChange={e => setPatientInput(e.target.value)}
                                                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendPatientMessage()}
                                                    disabled={chatLoading || isPatientRecording}
                                                />
                                                <Button
                                                    size="icon"
                                                    className="h-10 w-10 flex-shrink-0"
                                                    onClick={sendPatientMessage}
                                                    disabled={chatLoading || isPatientRecording || !patientInput.trim()}
                                                >
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCREEN 3B — DOCTOR WORKSPACE
    // Tabs: Patient Records | Clinical Chat  (NO Upload / Patient Chat here)
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-background">
            <Toaster />

            {/* ── Top bar ── */}
            <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                                <Home className="h-4 w-4" />
                                <span className="hidden sm:inline">Dashboard</span>
                            </Button>
                        </Link>
                        <span className="text-border">|</span>
                        {/* Doctor identity badge */}
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <Stethoscope className="h-3 w-3" /> Dr. · {doctorPatientName}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            {documents.length} document{documents.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <Button
                        variant="ghost" size="sm"
                        className="gap-1.5 text-muted-foreground flex-shrink-0"
                        onClick={signOut}
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">Sign Out</span>
                    </Button>
                </div>

                {/* Doctor tab bar — Patient Records / Clinical Chat */}
                <div className="max-w-5xl mx-auto px-4 sm:px-6 overflow-x-auto">
                    <div className="flex min-w-max">
                        <TabBtn active={doctorTab === "records"} onClick={() => setDoctorTab("records")}>
                            <FileText className="h-3.5 w-3.5" />
                            Patient Records {documents.length > 0 && `(${documents.length})`}
                        </TabBtn>
                        <TabBtn active={doctorTab === "doctor-chat"} onClick={() => setDoctorTab("doctor-chat")}>
                            <Stethoscope className="h-3.5 w-3.5" />
                            Clinical Chat
                        </TabBtn>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

                {/* ── Patient Records tab ── */}
                {doctorTab === "records" && (
                    <div className="space-y-5">

                        {/* Summary detail view */}
                        {viewingDocId ? (
                            <div className="space-y-4">
                                <button
                                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => { setViewingDocId(null); setSummaryDoc(null); }}
                                >
                                    <ArrowLeft className="h-4 w-4" /> Back to Patient Records
                                </button>

                                {summaryLoading && (
                                    <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin" /> Loading AI summary…
                                    </div>
                                )}

                                {summaryDoc && (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h2 className="text-lg font-semibold text-foreground">{summaryDoc.filename}</h2>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                                                {summaryDoc.doc_type}
                                            </span>
                                            <MatchBadge match={summaryDoc.name_match} extracted={summaryDoc.extracted_name} />
                                        </div>
                                        {/* Wrapper handles scroll/overflow; MdContent handles all typography */}
                                        <div className="border border-border bg-card rounded-xl p-5 overflow-y-auto max-h-[60vh] break-words">
                                            <MdContent>{summaryDoc.summary}</MdContent>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Document list for doctor */
                            <>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h2 className="text-lg font-semibold text-foreground">
                                            {doctorPatientName}&apos;s Records
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Read-only clinical view — {documents.length} document{documents.length !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline" size="sm" className="gap-1.5"
                                            onClick={() => loadDocuments(doctorPatientId)}
                                            disabled={docLoading}
                                        >
                                            {docLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                            Refresh
                                        </Button>
                                        {/* Switch patient without full sign-out */}
                                        <Button
                                            variant="outline" size="sm" className="gap-1.5"
                                            onClick={() => {
                                                setDoctorAuth(false);
                                                setDoctorPatientId("");
                                                setDoctorPatientName("");
                                                setDocuments([]);
                                                setDoctorChat([]);
                                                setSummaryDoc(null);
                                                setViewingDocId(null);
                                                setDocPatientSearch("");
                                            }}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> Switch Patient
                                        </Button>
                                    </div>
                                </div>

                                {docLoading && (
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground p-4">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading records…
                                    </div>
                                )}

                                {!docLoading && documents.length === 0 && (
                                    <div className="text-center py-16 space-y-2">
                                        <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                                        <p className="text-muted-foreground text-sm">No documents found for this patient.</p>
                                    </div>
                                )}

                                {!docLoading && documents.length > 0 && (
                                    <div className="space-y-3">
                                        {documents.map(doc => (
                                            <div
                                                key={doc.doc_id}
                                                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-border rounded-xl bg-card transition-colors"
                                            >
                                                <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <p className="font-medium text-sm text-foreground truncate">{doc.filename}</p>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">{doc.doc_type}</span>
                                                        {doc.timestamp && (
                                                            <span className="text-xs text-muted-foreground">{doc.timestamp.slice(0, 16)}</span>
                                                        )}
                                                        <MatchBadge match={doc.name_match} extracted={doc.extracted_name} />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline" size="sm" className="gap-1.5 flex-shrink-0"
                                                    onClick={() => handleViewSummary(doc.doc_id, doctorPatientId)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" /> Summary
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── Clinical Chat tab ── */}
                {doctorTab === "doctor-chat" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold text-foreground">Clinical Review</h2>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                        {doctorPatientName}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {documents.length} document{documents.length !== 1 ? "s" : ""} · AI-assisted clinical analysis
                                </p>
                            </div>
                            {doctorChat.length > 0 && (
                                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setDoctorChat([])}>
                                    <Trash2 className="h-3.5 w-3.5" /> Clear
                                </Button>
                            )}
                        </div>

                        {/* Fixed-height clinical chat window — matches patient chat UX */}
                        <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-background">

                            {/* Scrollable messages area */}
                            <div className="h-[50vh] md:h-[420px] overflow-y-auto p-4 space-y-4">
                                {doctorChat.map((m, i) => (
                                    <Bubble key={i} msg={m} aiLabel="Clinical AI" />
                                ))}
                                {chatLoading && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing clinical records…
                                    </div>
                                )}
                                <div ref={dChatBottomRef} />
                            </div>

                            {/* Doctor suggestion chips: horizontal scrollable pill row, vanish after first message */}
                            {doctorChat.length === 0 && (
                                <div className="border-t border-border px-3 py-2 flex flex-row gap-2 overflow-x-auto scrollbar-none">
                                    {[
                                        `What are ${doctorPatientName}'s current diagnoses?`,
                                        "List all medications with dosages",
                                        "Are there any critical lab values?",
                                        "Summarise the patient's medical history",
                                        "What follow-up care is recommended?",
                                        "Are there any drug interactions to note?",
                                    ].map(s => (
                                        <button key={s} onClick={() => setDoctorInput(s)}
                                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                                        >{s}</button>
                                    ))}
                                </div>
                            )}

                            {/* Sticky input bar with mic + text + send */}
                            <div className="border-t border-border p-3 bg-background">
                                <div className="flex items-center gap-2">
                                    {/* Mic button: pulses red while recording */}
                                    <Button
                                        variant={isDoctorRecording ? "default" : "outline"}
                                        size="icon"
                                        type="button"
                                        className="h-10 w-10 flex-shrink-0"
                                        onClick={isDoctorRecording ? stopDoctorRecording : startDoctorRecording}
                                        disabled={chatLoading}
                                        title={isDoctorRecording ? "Stop recording" : "Start voice input"}
                                    >
                                        <Mic className={`h-4 w-4 ${isDoctorRecording ? "animate-pulse" : ""}`} />
                                    </Button>

                                    <input
                                        className="flex-1 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        placeholder={`Clinical questions about ${doctorPatientName}…`}
                                        value={doctorInput}
                                        onChange={e => setDoctorInput(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendDoctorMessage()}
                                        disabled={chatLoading || isDoctorRecording}
                                    />
                                    <Button
                                        size="icon"
                                        className="h-10 w-10 flex-shrink-0"
                                        onClick={sendDoctorMessage}
                                        disabled={chatLoading || isDoctorRecording || !doctorInput.trim()}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
