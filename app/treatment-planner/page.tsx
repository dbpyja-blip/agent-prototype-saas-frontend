"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Send, Loader2, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/use-toast";
import { LoadingDots } from "@/components/ui/loading-dots";
import { TreatmentPlanCard } from "@/components/treatment-plan-card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
    role: "user" | "assistant";
    content: string | React.ReactNode;
    treatment_plans?: any[];
};

export default function TreatmentPlannerPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [treatmentText, setTreatmentText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isInitialInput, setIsInitialInput] = useState(true);
    const [sessionId] = useState(`session_${Date.now()}`);
    const [userId] = useState(`user_${Date.now()}`);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();

    const TREATMENT_PLANNER_API =
        process.env.NEXT_PUBLIC_TREATMENT_PLANNER_BACKEND_URL ||
        "http://localhost:8002";
    const TRANSCRIPTION_API =
        process.env.NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL ||
        "http://localhost:8000";

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (text: string, isInitial: boolean = false) => {
        if (!text.trim()) return;

        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setInput("");
        setIsLoading(true);

        try {
            const payload: any = {
                session_id: sessionId,
                user_id: userId,
                slot_id: "reference_only",
            };

            if (isInitial) {
                payload.treatment_text = text;
            } else {
                payload.input = text;
            }

            const response = await fetch(
                `${TREATMENT_PLANNER_API}/agent/treatment-planner`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const data = await response.json();

            const responseText = data.message || "No response";
            const treatmentPlans = data.treatment_plans || [];

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: responseText,
                    treatment_plans: treatmentPlans,
                },
            ]);

            if (data.status === "finished") {
                toast({
                    title: "Treatment Plan Complete",
                    description: "Your treatment plan has been finalized",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to communicate with the server",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInitialSubmit = () => {
        if (treatmentText.trim()) {
            sendMessage(treatmentText, true);
            setIsInitialInput(false);
            setTreatmentText("");
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach((track) => track.stop());

                await transcribeAndSend(blob);
            };

            mediaRecorder.start();
            setIsRecording(true);

            toast({
                title: "Recording",
                description: "Speak your treatment notes or edits...",
            });
        } catch (error) {
            toast({
                title: "Microphone Error",
                description: "Could not access microphone",
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const transcribeAndSend = async (audioBlob: Blob) => {
        if (isInitialInput) {
            // For initial input, show loading dots on user side
            const transcribingMessage: Message = {
                role: "user",
                content: <LoadingDots variant="dark" />,
            };
            setMessages((prev) => [...prev, transcribingMessage]);
        }

        try {
            const formData = new FormData();
            const file = new File([audioBlob], "recording.webm", {
                type: "audio/webm",
            });
            formData.append("file", file);

            const response = await fetch(`${TRANSCRIPTION_API}/transcription`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Transcription failed");
            }

            const data = await response.json();
            const transcribedText = data.transcription || "";

            if (transcribedText) {
                if (isInitialInput) {
                    // Remove the transcribing message
                    setMessages((prev) => prev.slice(0, -1));
                    setTreatmentText(transcribedText);
                } else {
                    // For edit workflow, just send - sendMessage handles adding to UI
                    sendMessage(transcribedText, false);
                }
            } else if (isInitialInput) {
                // Remove transcribing message if no text
                setMessages((prev) => prev.slice(0, -1));
            }
        } catch (error) {
            if (isInitialInput) {
                setMessages((prev) => prev.slice(0, -1));
            }
            toast({
                title: "Transcription Error",
                description: "Failed to transcribe audio",
            });
        }
    };

    return (
        <div className="min-h-screen bg-background p-4">
            <Toaster />
            <div className="max-w-4xl mx-auto space-y-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Treatment Planner
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            AI-assisted treatment planning with edit workflow
                        </p>
                    </div>
                    <Link href="/dashboard">
                        <Button variant="outline">Back to Home</Button>
                    </Link>
                </div>

                {/* Initial Input or Chat */}
                {isInitialInput ? (
                    <div className="border border-border bg-card p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-2 text-foreground">
                                Enter Treatment Notes
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Describe the treatment plan you want to create
                            </p>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                value={treatmentText}
                                onChange={(e) => setTreatmentText(e.target.value)}
                                placeholder="E.g., Patient needs hair transplant, 3000 grafts, FUE method, also prescribe finasteride and minoxidil..."
                                className="w-full min-h-[200px] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                                disabled={isLoading}
                            />

                            <div className="flex items-center gap-2">
                                <Button
                                    variant={isRecording ? "default" : "outline"}
                                    size="icon"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isLoading}
                                >
                                    <Mic
                                        className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
                                    />
                                </Button>

                                <Button
                                    onClick={handleInitialSubmit}
                                    disabled={isLoading || !treatmentText.trim()}
                                    className="flex-1 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <LoadingDots variant="dark" />
                                    ) : (
                                        "Create Treatment Plan"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="border border-border bg-card">
                        {/* Messages */}
                        <div className="h-[500px] overflow-y-auto p-6 space-y-4">
                            {messages.map((message, index) => (
                                <div key={index}>
                                    <div className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""
                                        }`}>
                                        <div className="p-2 bg-secondary">
                                            {message.role === "user" ? (
                                                <User className="h-5 w-5" />
                                            ) : (
                                                <Bot className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className={`flex-1 ${message.role === "user" ? "text-right" : ""
                                            }`}>
                                            <p className={`text-sm font-mono text-muted-foreground mb-1 ${message.role === "user" ? "text-right" : ""
                                                }`}>
                                                {message.role === "user" ? "You" : "Planner AI"}
                                            </p>

                                            {/* Treatment Plan Cards ABOVE Message */}
                                            {message.treatment_plans && message.treatment_plans.length > 0 && (
                                                <div className="mb-4">
                                                    <TreatmentPlanCard plans={message.treatment_plans} />
                                                </div>
                                            )}

                                            {/* Message Content BELOW Cards */}
                                            <div
                                                className={`inline-block p-3 max-w-[80%] ${message.role === "user"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-secondary text-secondary-foreground"
                                                    }`}
                                            >
                                                {typeof message.content === "string" ? (
                                                    <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {message.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    message.content
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-secondary">
                                        <Bot className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-mono text-muted-foreground mb-1">
                                            Planner AI
                                        </p>
                                        <div className="inline-block p-3 bg-secondary">
                                            <LoadingDots variant="light" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Edit Input */}
                        <div className="border-t border-border p-4">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={isRecording ? "default" : "outline"}
                                    size="icon"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isLoading}
                                >
                                    <Mic
                                        className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
                                    />
                                </Button>

                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(input);
                                        }
                                    }}
                                    placeholder="Edit instructions (e.g., 'Change Plan A to 2500 grafts')"
                                    disabled={isLoading || isRecording}
                                    className="flex-1"
                                />

                                <Button
                                    onClick={() => sendMessage(input)}
                                    disabled={isLoading || isRecording || !input.trim()}
                                    size="icon"
                                >
                                    <Send className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
