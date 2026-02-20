"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Send, User, Bot, Upload, X, FileText, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/use-toast";
import { LoadingDots } from "@/components/ui/loading-dots";
import { UploadModal } from "@/components/ui/upload-modal";
import { MCQOptions } from "@/components/ui/mcq-options";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
    role: "user" | "assistant";
    content: string | React.ReactNode;
    bookingSummary?: string;
};

export default function PreConsultationPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    // Always generate a FRESH session ID on every page load.
    // We deliberately do NOT read from localStorage here — doing so was
    // causing the backend to resume the old conversation after a refresh.
    const [sessionId] = useState(() => {
        const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (typeof window !== "undefined") {
            // Clear any stale session so it can never be accidentally reused
            localStorage.removeItem("pre_consult_session_id");
        }
        return newId;
    });

    // userId represents the person, not the session — it's fine to persist this.
    const [userId] = useState(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("pre_consult_user_id");
            if (stored) return stored;
            const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            localStorage.setItem("pre_consult_user_id", newId);
            return newId;
        }
        return `user_${Date.now()}`;
    });
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadQuestion, setUploadQuestion] = useState("");
    const [conversationEnded, setConversationEnded] = useState(false);
    const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const { toast } = useToast();
    const hasStartedRef = useRef(false);

    // MCQ state
    const [currentMCQ, setCurrentMCQ] = useState<{
        question: string;
        options: string[];
        isMultiSelect: boolean;
    } | null>(null);

    const PRECONSULTATION_API =
        process.env.NEXT_PUBLIC_PRECONSULTATION_BACKEND_URL ||
        "http://localhost:8001";
    const TRANSCRIPTION_API =
        process.env.NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL ||
        "http://localhost:8000";

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // Prevent duplicate calls on mount
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            sendMessage("start");
        }
    }, []);

    const sendMessage = async (text: string) => {
        if (!text.trim() && text !== "start") return;

        // Prevent sending messages if conversation has ended
        if (conversationEnded && text !== "start") {
            toast({
                title: "Conversation Ended",
                description: "The pre-consultation checklist is complete.",
            });
            return;
        }

        if (text !== "start") {
            setMessages((prev) => [...prev, { role: "user", content: text }]);
        }
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch(
                `${PRECONSULTATION_API}/agent/pre-consultation`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        session_id: sessionId,
                        user_id: userId,
                        input: text === "start" ? "Hello" : text,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const data = await response.json();

            // Check if conversation has ended
            if (data.status === "end") {
                setConversationEnded(true);
                setCurrentMCQ(null); // Clear any MCQ
            }

            // Check if this is an MCQ question
            if (data.question_type === "mcq" && data.mcq_options && data.mcq_options.length > 0 && data.status !== "end") {
                setCurrentMCQ({
                    question: data.mcq_question || data.response || "",
                    options: data.mcq_options,
                    isMultiSelect: data.is_multi_select || false,
                });
            } else {
                setCurrentMCQ(null);
            }

            // Check if this is an upload question
            if (data.question_type === "upload" || (data.response && data.response.toLowerCase().includes("upload")) || (data.response && data.response.toLowerCase().includes("verification photo"))) {
                setUploadQuestion(data.response || "Please upload your verification photo");
                // Show modal after a brief delay so the message appears first
                setTimeout(() => {
                    setShowUploadModal(true);
                }, 100);
            }

            const messageContent = data.response || "No response";

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: messageContent,
                    bookingSummary: data.booking_summary
                },
            ]);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to communicate with the server",
            });
        } finally {
            setIsLoading(false);
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

                // Transcribe and send
                await transcribeAndSend(blob);
            };

            mediaRecorder.start();
            setIsRecording(true);

            toast({
                title: "Recording",
                description: "Speak your response...",
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
        // Show loading dots on USER side
        const transcribingMessage: Message = {
            role: "user",
            content: <LoadingDots variant="dark" />,
        };
        setMessages((prev) => [...prev, transcribingMessage]);

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
                // Replace the loading dots with actual transcription
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: "user",
                        content: transcribedText,
                    };
                    return updated;
                });

                // Now send to backend
                setInput("");
                setIsLoading(true);

                try {
                    const response = await fetch(
                        `${PRECONSULTATION_API}/agent/pre-consultation`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                session_id: sessionId,
                                user_id: userId,
                                input: transcribedText,
                            }),
                        }
                    );

                    if (!response.ok) {
                        throw new Error("Failed to get response");
                    }

                    const responseData = await response.json();

                    const messageContent = responseData.response || "No response";

                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "assistant",
                            content: messageContent,
                            bookingSummary: responseData.booking_summary
                        },
                    ]);
                } catch (error) {
                    toast({
                        title: "Error",
                        description: "Failed to communicate with the server",
                    });
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Remove the transcribing message if no transcription
                setMessages((prev) => prev.slice(0, -1));
            }
        } catch (error) {
            // Remove the transcribing message on error
            setMessages((prev) => prev.slice(0, -1));
            toast({
                title: "Transcription Error",
                description: "Failed to transcribe audio",
            });
        }
    };

    const handleFileUpload = async (file: File) => {
        // Acknowledge the upload and continue
        toast({
            title: "Upload Successful",
            description: `${file.name} has been uploaded`,
        });

        // Send confirmation to backend
        setShowUploadModal(false);
        sendMessage("I have uploaded the image");
    };

    const handleMCQSubmit = (selectedOptions: string[]) => {
        if (conversationEnded) return; // Prevent submission if conversation ended
        const answerText = selectedOptions.join(",");
        sendMessage(answerText);
        setCurrentMCQ(null);
    };

    const handleMCQSkip = () => {
        if (conversationEnded) return; // Prevent skip if conversation ended
        sendMessage("Skip");
        setCurrentMCQ(null);
    };


    return (
        <div className="min-h-screen bg-background p-4">
            <Toaster />
            <div className="max-w-4xl mx-auto space-y-4 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Pre-Consultation
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            AI-powered patient intake
                        </p>
                    </div>
                    <Link href="/dashboard" className="self-start sm:self-auto">
                        <Button variant="outline" className="whitespace-nowrap">
                            <Home className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Back to Home</span>
                            <span className="sm:hidden">Home</span>
                        </Button>
                    </Link>
                </div>

                {/* Chat Container */}
                <div className="border border-border bg-card">
                    {/* Messages */}
                    <div className="h-[60vh] md:h-[500px] overflow-y-auto p-6 space-y-4">
                        {messages.map((message, index) => (
                            <div key={index}>
                                <div
                                    className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""
                                        }`}
                                >
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
                                            {message.role === "user" ? "You" : "HEALTHBOT"}
                                        </p>
                                        <div
                                            className={`inline-block p-3 ${message.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-secondary text-secondary-foreground"
                                                }`}
                                        >
                                            {typeof message.content === "string" ? (
                                                message.role === "assistant" ? (
                                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {message.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm whitespace-pre-wrap text-left">
                                                        {message.content}
                                                    </p>
                                                )
                                            ) : (
                                                message.content
                                            )}
                                        </div>

                                        {/* View Summary Button */}
                                        {message.bookingSummary && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-2 w-full justify-start gap-2 border-primary/20 hover:bg-primary/10"
                                                onClick={() => setSelectedSummary(message.bookingSummary!)}
                                            >
                                                <FileText className="h-4 w-4" />
                                                View Clinical Summary
                                            </Button>
                                        )}

                                        {/* Show MCQ options if this is the last assistant message and MCQ is active */}
                                        {message.role === "assistant" &&
                                            index === messages.length - 1 &&
                                            currentMCQ &&
                                            !isLoading && (
                                                <div className="mt-3">
                                                    <MCQOptions
                                                        question={currentMCQ.question}
                                                        options={currentMCQ.options}
                                                        isMultiSelect={currentMCQ.isMultiSelect}
                                                        onSubmit={handleMCQSubmit}
                                                        onSkip={handleMCQSkip}
                                                    />
                                                </div>
                                            )}
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
                                        HEALTHBOT
                                    </p>
                                    <div className="inline-block p-3 bg-secondary">
                                        <LoadingDots variant="light" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-border p-4">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            sendMessage(input);
                        }} className="flex items-center gap-2">
                            <Button
                                variant={isRecording ? "default" : "outline"}
                                size="icon"
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={isLoading || !!currentMCQ || conversationEnded}
                                type="button" // Prevent form submission
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
                                placeholder={
                                    conversationEnded
                                        ? "Consultation complete"
                                        : currentMCQ
                                            ? "Please select from the options above"
                                            : "Type your response..."
                                }
                                disabled={isLoading || isRecording || !!currentMCQ || conversationEnded}
                                className="flex-1"
                            />

                            <Button
                                onClick={() => sendMessage(input)}
                                disabled={isLoading || isRecording || !input.trim() || !!currentMCQ || conversationEnded}
                                size="icon"
                                type="submit"
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Upload Modal */}
                <UploadModal
                    isOpen={showUploadModal}
                    onClose={() => {
                        setShowUploadModal(false);
                        sendMessage("Skip");
                    }}
                    questionText={uploadQuestion}
                    onUpload={handleFileUpload}
                />

                {/* Summary Logic Modal */}
                {selectedSummary && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                        <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30 rounded-t-xl">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-semibold tracking-tight">Clinical Consultation Summary</h2>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedSummary(null)} className="h-8 w-8 rounded-full">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-6 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {selectedSummary}
                                </ReactMarkdown>
                            </div>
                            <div className="p-4 border-t border-border bg-muted/30 rounded-b-xl flex justify-end">
                                <Button onClick={() => setSelectedSummary(null)}>Close</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
