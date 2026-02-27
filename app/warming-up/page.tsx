"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    MessageSquare,
    Stethoscope,
    FileText,
    Mic,
    ShieldCheck,
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowRight,
    Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Agent definition ─────────────────────────────────────────────────────────
// Each entry maps to one backend micro-service deployed on Render.
// The health endpoint is polled repeatedly until the service wakes up.
type AgentStatus = "idle" | "pinging" | "active" | "timeout";

interface AgentDef {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    // env var key (resolved at runtime via process.env) and its local fallback
    envVar: string;
    fallback: string;
    healthPath: string; // path to GET for health check
    color: string;      // tailwind text colour for the icon
    bgColor: string;    // tailwind bg colour for the icon ring
}

const AGENTS: AgentDef[] = [
    {
        id: "pre-consultation",
        label: "Pre-Consultation",
        description: "Patient intake & medical history chatbot",
        icon: MessageSquare,
        envVar: "NEXT_PUBLIC_PRECONSULTATION_BACKEND_URL",
        fallback: "http://localhost:8001",
        healthPath: "/",
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
    },
    {
        id: "consultation",
        label: "Consultation Notes",
        description: "SOAP note generation from raw transcripts",
        icon: Stethoscope,
        envVar: "NEXT_PUBLIC_CONSULTATION_BACKEND_URL",
        fallback: "http://localhost:8004",
        healthPath: "/",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
    },
    {
        id: "treatment",
        label: "Treatment Planner",
        description: "AI-assisted treatment plan creator",
        icon: FileText,
        envVar: "NEXT_PUBLIC_TREATMENT_PLANNER_BACKEND_URL",
        fallback: "http://localhost:8002",
        healthPath: "/",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
    },
    {
        id: "transcription",
        label: "Transcription",
        description: "Voice recording & medical transcription",
        icon: Mic,
        envVar: "NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL",
        fallback: "http://localhost:8000",
        healthPath: "/",
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
    },
    {
        id: "prescription",
        label: "Prescription Analyzer",
        description: "FDA-backed drug interaction & safety checks",
        icon: ShieldCheck,
        envVar: "NEXT_PUBLIC_PRESCRIPTION_BACKEND_URL",
        fallback: "http://localhost:8006",
        healthPath: "/",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
    },
    {
        id: "emr",
        label: "MedRecord AI",
        description: "Medical document intelligence & patient chat",
        icon: FileText,
        envVar: "NEXT_PUBLIC_EMR_BACKEND_URL",
        fallback: "http://localhost:8010",
        healthPath: "/",
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
    },
];

// Maximum wall-clock time to keep trying one agent before marking it as failed (2 minutes)
const AGENT_TIMEOUT_MS = 120_000;
// Maximum number of fetch attempts per agent before giving up
const MAX_RETRIES = 5;
// Delay between retry attempts (ms) — 120s / 5 retries = ~24s breathing room per attempt
const POLL_INTERVAL_MS = 5_000;

// ── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AgentStatus }) {
    if (status === "active") {
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle className="h-3 w-3" />
                Active
            </span>
        );
    }
    if (status === "timeout") {
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <AlertCircle className="h-3 w-3" />
                Slow — may be delayed
            </span>
        );
    }
    // pinging / idle
    return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
            <Loader2 className="h-3 w-3 animate-spin" />
            Waking up…
        </span>
    );
}

// ── AgentCard — vertical card that sits inside the grid ─────────────────────
function AgentCard({ agent, status }: { agent: AgentDef; status: AgentStatus }) {
    const Icon = agent.icon;
    const isActive  = status === "active";
    const isTimeout = status === "timeout";

    return (
        <div
            className={`
                relative flex flex-col gap-4 p-5 rounded-xl border transition-all duration-500 h-full
                ${isActive
                    ? "border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-emerald-500/10"
                    : isTimeout
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-border bg-card"
                }
            `}
        >
            {/* Top row: icon + name/description */}
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 p-2.5 rounded-xl ${agent.bgColor}`}>
                    <Icon className={`h-5 w-5 ${agent.color}`} />
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-tight">
                        {agent.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {agent.description}
                    </p>
                </div>
            </div>

            {/* Bottom: status badge */}
            <div className="mt-auto">
                <StatusBadge status={status} />
            </div>

            {/* Pulse border while waking up */}
            {status === "pinging" && (
                <span className="absolute inset-0 rounded-xl border border-primary/20 animate-pulse pointer-events-none" />
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WarmingUpPage() {
    const router = useRouter();

    // Map agentId → status
    const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(
        Object.fromEntries(AGENTS.map((a) => [a.id, "idle"]))
    );

    const [allDone, setAllDone]       = useState(false);
    const [anyTimeout, setAnyTimeout] = useState(false);

    // Resolve the base URL for an agent from env or fallback
    const getBaseUrl = (agent: AgentDef): string => {
        // Next.js inlines NEXT_PUBLIC_ env vars at build time via process.env
        // We access them via a lookup so TypeScript doesn't complain about dynamic keys
        const envMap: Record<string, string | undefined> = {
            NEXT_PUBLIC_PRECONSULTATION_BACKEND_URL:   process.env.NEXT_PUBLIC_PRECONSULTATION_BACKEND_URL,
            NEXT_PUBLIC_CONSULTATION_BACKEND_URL:      process.env.NEXT_PUBLIC_CONSULTATION_BACKEND_URL,
            NEXT_PUBLIC_TREATMENT_PLANNER_BACKEND_URL: process.env.NEXT_PUBLIC_TREATMENT_PLANNER_BACKEND_URL,
            NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL:     process.env.NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL,
            NEXT_PUBLIC_PRESCRIPTION_BACKEND_URL:      process.env.NEXT_PUBLIC_PRESCRIPTION_BACKEND_URL,
            NEXT_PUBLIC_EMR_BACKEND_URL:               process.env.NEXT_PUBLIC_EMR_BACKEND_URL,
        };
        return (envMap[agent.envVar] ?? agent.fallback).replace(/\/$/, "");
    };

    // Poll a single agent — stops when:
    //   (a) the agent responds with 200 OK, OR
    //   (b) MAX_RETRIES attempts have been exhausted, OR
    //   (c) AGENT_TIMEOUT_MS (2 min) has elapsed — whichever comes first.
    const pollAgent = useCallback(async (agent: AgentDef) => {
        setStatuses((prev) => ({ ...prev, [agent.id]: "pinging" }));

        const url      = `${getBaseUrl(agent)}${agent.healthPath}`;
        const deadline = Date.now() + AGENT_TIMEOUT_MS;
        let   attempts = 0;

        while (attempts < MAX_RETRIES && Date.now() < deadline) {
            attempts += 1;
            try {
                const controller  = new AbortController();
                // Each single fetch attempt gets 10 seconds before being aborted
                const fetchTimer  = setTimeout(() => controller.abort(), 10_000);

                const res = await fetch(url, {
                    method: "GET",
                    signal: controller.signal,
                    // No credentials → simple CORS request, avoids preflight issues
                });
                clearTimeout(fetchTimer);

                if (res.ok) {
                    setStatuses((prev) => ({ ...prev, [agent.id]: "active" }));
                    return; // success — done
                }
            } catch {
                // AbortError (per-attempt 10s timeout) or network error — will retry
            }

            // Only wait between retries if there are more attempts left
            if (attempts < MAX_RETRIES && Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            }
        }

        // All retries or 2-minute deadline exhausted without a 200 response
        setStatuses((prev) => ({ ...prev, [agent.id]: "timeout" }));
    }, []);

    // Kick off all polls in parallel on mount
    useEffect(() => {
        Promise.all(AGENTS.map(pollAgent)).then(() => {
            setAllDone(true);
        });
    }, [pollAgent]);

    // Watch statuses to detect when everything settled
    useEffect(() => {
        const values = Object.values(statuses);
        const done   = values.every((s) => s === "active" || s === "timeout");
        if (!done) return;

        setAnyTimeout(values.some((s) => s === "timeout"));
        setAllDone(true);
        // No auto-redirect — user clicks "Enter Dashboard" themselves
    }, [statuses]);

    // Progress: count active + timeout as "done"
    const doneCount  = Object.values(statuses).filter((s) => s === "active" || s === "timeout").length;
    const totalCount = AGENTS.length;
    const progressPct = Math.round((doneCount / totalCount) * 100);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10 sm:px-6">
            <div className="w-full max-w-4xl space-y-8">

                {/* ── Header ── */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
                        <Zap className="h-3.5 w-3.5 animate-pulse" />
                        Initialising AI Agents
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                        {allDone ? "Agents Ready" : "Waking Up Your AI Agents"}
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                        {allDone
                            ? anyTimeout
                                ? "Some agents are taking longer than usual. You can still enter the dashboard — they'll be ready shortly."
                                : "All agents are online and ready. Taking you to the dashboard…"
                            : "Your AI agents are hosted on the cloud and may need a moment to spin up. This only happens once."}
                    </p>
                </div>

                {/* ── Progress bar ── */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                        <span>{doneCount} / {totalCount} agents ready</span>
                        <span>{progressPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* ── Agent Cards — 1 col mobile → 2 col tablet → 3 col desktop ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {AGENTS.map((agent) => (
                        <AgentCard
                            key={agent.id}
                            agent={agent}
                            status={statuses[agent.id]}
                        />
                    ))}
                </div>

                {/* ── CTA — shown once all agents have settled ── */}
                {allDone && (
                    <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Button
                            className="w-full h-12 text-base gap-2 rounded-xl shadow-md shadow-primary/20"
                            onClick={() => router.push("/dashboard")}
                        >
                            Start Using Your Agents
                            <ArrowRight className="h-4 w-4" />
                        </Button>

                        {/* Timeout note */}
                        {anyTimeout && (
                            <p className="text-center text-xs text-amber-500/80">
                                Some agents are still waking up in the background. They'll be ready by the time you need them.
                            </p>
                        )}
                    </div>
                )}

                {/* ── Footer note ── */}
                <p className="text-center text-xs text-muted-foreground/60 font-mono tracking-wider">
                    POWERED BY DimensionLeap
                </p>
            </div>
        </div>
    );
}
