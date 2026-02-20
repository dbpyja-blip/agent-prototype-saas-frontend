"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Upload, Loader2, FileText, ArrowRight, Stethoscope, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/use-toast";

export default function ConsultationNotesPage() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [transcription, setTranscription] = useState("");
    const [manualText, setManualText] = useState("");
    const [soapNote, setSoapNote] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();

    const TRANSCRIPTION_API =
        process.env.NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL ||
        "http://localhost:8000";

    // Consultation Agent URL (ensure this matches your .env)
    const CONSULTATION_API =
        process.env.NEXT_PUBLIC_CONSULTATION_BACKEND_URL ||
        "http://localhost:8004";

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

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

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setAudioBlob(blob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

            toast({
                title: "Recording Started",
                description: "Speak clearly into your microphone",
            });
        } catch (error) {
            toast({
                title: "Microphone Error",
                description: "Could not access microphone. Please check permissions.",
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            toast({
                title: "Recording Stopped",
                description: "Ready to process",
            });
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            if (isPaused) {
                mediaRecorderRef.current.resume();
                setIsPaused(false);
                timerRef.current = setInterval(() => {
                    setRecordingTime((prev) => prev + 1);
                }, 1000);
            } else {
                mediaRecorderRef.current.pause();
                setIsPaused(true);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            }
        }
    };

    const processAudio = async (file: File) => {
        setIsLoading(true);
        setTranscription("");
        setSoapNote(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            // Step 1: Transcribe Audio
            toast({
                title: "Step 1: Transcribing Audio...",
                description: "Converting speech to text.",
            });

            const transResponse = await fetch(`${TRANSCRIPTION_API}/transcription`, {
                method: "POST",
                body: formData,
            });

            if (!transResponse.ok) {
                throw new Error("Transcription failed");
            }

            const transData = await transResponse.json();
            const transcriptText = transData.transcription;
            setTranscription(transcriptText || "No transcription received");

            if (!transcriptText) {
                throw new Error("Empty transcription received");
            }

            // Step 2: Generate SOAP Note
            toast({
                title: "Step 2: Generating SOAP Note...",
                description: "Analyzing clinical context.",
            });

            const consultationResponse = await fetch(`${CONSULTATION_API}/agent/unstructured-note`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    raw_text: transcriptText
                }),
            });

            if (!consultationResponse.ok) {
                const errorData = await consultationResponse.json();
                throw new Error(errorData.detail || "Consultation agent failed");
            }

            const consultationData = await consultationResponse.json();

            if (consultationData.success && consultationData.data) {
                setSoapNote(consultationData.data);
                toast({
                    title: "Success",
                    description: "Clinical SOAP note generated successfully.",
                });
            } else {
                throw new Error(consultationData.error || "Failed to generate note");
            }

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Processing Error",
                description: error.message || "An error occurred during processing.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const processText = async () => {
        if (!manualText.trim()) {
            toast({
                title: "Empty Input",
                description: "Please enter some text to process.",
            });
            return;
        }

        setIsLoading(true);
        setTranscription(manualText);
        setSoapNote(null);

        try {
            // Step 1: Generate SOAP Note directly
            toast({
                title: "Generating SOAP Note...",
                description: "Analyzing clinical context from text.",
            });

            const consultationResponse = await fetch(`${CONSULTATION_API}/agent/unstructured-note`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    raw_text: manualText
                }),
            });

            if (!consultationResponse.ok) {
                const errorData = await consultationResponse.json();
                throw new Error(errorData.detail || "Consultation agent failed");
            }

            const consultationData = await consultationResponse.json();

            if (consultationData.success && consultationData.data) {
                setSoapNote(consultationData.data);
                toast({
                    title: "Success",
                    description: "Clinical SOAP note generated successfully.",
                });
            } else {
                throw new Error(consultationData.error || "Failed to generate note");
            }

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Processing Error",
                description: error.message || "An error occurred during processing.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processAudio(file);
        }
    };

    const submitRecording = () => {
        if (audioBlob) {
            const file = new File([audioBlob], "recording.webm", {
                type: "audio/webm",
            });
            processAudio(file);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    };

    return (
        <div className="min-h-screen bg-background p-4">
            <Toaster />
            <div className="max-w-4xl mx-auto space-y-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Consultation Notes
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Record consultation or upload audio to generate SOAP notes
                        </p>
                    </div>
                    <Link href="/dashboard">
                        <Button variant="outline">Back to Home</Button>
                    </Link>
                </div>

                {/* Recording Controls */}
                <div className="border border-border bg-card p-8 rounded-lg shadow-sm">
                    <div className="flex flex-col items-center space-y-6">
                        {/* Timer */}
                        {isRecording && (
                            <div className="text-center">
                                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                                    Recording Time
                                </p>
                                <p className="text-4xl font-mono font-bold text-foreground mt-2">
                                    {formatTime(recordingTime)}
                                </p>
                            </div>
                        )}

                        {/* Recording Status */}
                        <div className="flex items-center space-x-2">
                            {isRecording && (
                                <div
                                    className={`h-3 w-3 rounded-full ${isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
                                        }`}
                                />
                            )}
                            <p className="text-sm font-mono text-muted-foreground">
                                {isRecording
                                    ? isPaused
                                        ? "Paused"
                                        : "Recording..."
                                    : audioBlob
                                        ? "Recording Complete"
                                        : "Ready to Record"}
                            </p>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center gap-4">
                            {!isRecording && !audioBlob && (
                                <Button
                                    onClick={startRecording}
                                    size="lg"
                                    disabled={isLoading}
                                    className="h-16 w-16 rounded-full shadow-md transition-transform hover:scale-105"
                                >
                                    <Mic className="h-6 w-6" />
                                </Button>
                            )}

                            {isRecording && (
                                <>
                                    <Button
                                        onClick={pauseRecording}
                                        variant="outline"
                                        size="lg"
                                        className="h-14 w-14 rounded-full"
                                    >
                                        {isPaused ? (
                                            <Play className="h-5 w-5" />
                                        ) : (
                                            <Pause className="h-5 w-5" />
                                        )}
                                    </Button>
                                    <Button
                                        onClick={stopRecording}
                                        variant="default"
                                        size="lg"
                                        className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 shadow-md"
                                    >
                                        <Square className="h-6 w-6" />
                                    </Button>
                                </>
                            )}

                            {audioBlob && !isRecording && (
                                <Button
                                    onClick={submitRecording}
                                    size="lg"
                                    disabled={isLoading}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Generate SOAP Note
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Upload Option */}
                        <div className="w-full max-w-md">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">
                                        Or upload an audio file
                                    </span>
                                </div>
                            </div>

                            <label
                                htmlFor="file-upload"
                                className={`mt-4 flex cursor-pointer items-center justify-center gap-2 border border-border bg-secondary p-4 transition-colors hover:bg-secondary/80 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Upload className="h-5 w-5 text-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                    Choose Audio File
                                </span>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={isLoading}
                                />
                            </label>
                        </div>

                        {/* Text Input Option */}
                        <div className="w-full max-w-md">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">
                                        Or paste transcript
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Paste consultation transcript here..."
                                    value={manualText}
                                    onChange={(e) => setManualText(e.target.value)}
                                    disabled={isLoading || isRecording}
                                />
                                <Button
                                    onClick={processText}
                                    className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                    disabled={!manualText.trim() || isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Keyboard className="mr-2 h-4 w-4" />
                                    )}
                                    Process Text
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Transcript */}
                    {(transcription || isLoading) && (
                        <div className="border border-border bg-card p-6 rounded-lg shadow-sm h-full">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="p-2 bg-secondary rounded-md">
                                    <FileText className="h-5 w-5 text-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground">
                                    Transcript
                                </h2>
                            </div>

                            {isLoading && !transcription ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground animate-pulse">Transcribing audio...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm prose-invert max-w-none max-h-[500px] overflow-y-auto bg-muted/30 p-4 rounded-md border border-border/50">
                                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                                        {transcription}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SOAP Note */}
                    {(soapNote || (isLoading && transcription)) && (
                        <div className="border border-border bg-card p-6 rounded-lg shadow-sm h-full ring-1 ring-primary/20">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <Stethoscope className="h-5 w-5 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground">
                                    Clinical SOAP Note
                                </h2>
                            </div>

                            {isLoading && !soapNote ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground animate-pulse">Analyzing clinical context...</p>
                                </div>
                            ) : soapNote ? (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    {/* Subjective */}
                                    <div className="bg-muted/30 p-4 rounded-md border-l-4 border-blue-500">
                                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wide mb-2">Subjective</h3>
                                        <p className="text-foreground text-sm leading-relaxed">{soapNote.subjective || soapNote.Subjective}</p>
                                    </div>

                                    {/* Objective */}
                                    <div className="bg-muted/30 p-4 rounded-md border-l-4 border-green-500">
                                        <h3 className="text-sm font-bold text-green-400 uppercase tracking-wide mb-2">Objective</h3>
                                        <p className="text-foreground text-sm leading-relaxed">{soapNote.objective || soapNote.Objective}</p>
                                    </div>

                                    {/* Assessment */}
                                    <div className="bg-muted/30 p-4 rounded-md border-l-4 border-yellow-500">
                                        <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wide mb-2">Assessment</h3>
                                        <p className="text-foreground text-sm leading-relaxed">{soapNote.assessment || soapNote.Assessment}</p>
                                    </div>

                                    {/* Plan */}
                                    <div className="bg-muted/30 p-4 rounded-md border-l-4 border-red-500">
                                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide mb-2">Plan</h3>
                                        <p className="text-foreground text-sm leading-relaxed">{soapNote.plan || soapNote.Plan}</p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
