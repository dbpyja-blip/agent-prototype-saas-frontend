"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/use-toast";

export default function TranscriptionPage() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [transcription, setTranscription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();

    const TRANSCRIPTION_API =
        process.env.NEXT_PUBLIC_TRANSCRIPTION_BACKEND_URL ||
        "http://localhost:8000";

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
                description: "Ready to transcribe",
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

    const uploadFile = async (file: File) => {
        setIsLoading(true);
        setTranscription("");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${TRANSCRIPTION_API}/transcription`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Transcription failed");
            }

            const data = await response.json();
            setTranscription(data.transcription || "No transcription received");

            toast({
                title: "Transcription Complete",
                description: "Your audio has been transcribed successfully",
            });
        } catch (error) {
            toast({
                title: "Transcription Error",
                description: "Failed to transcribe audio. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
        }
    };

    const submitRecording = () => {
        if (audioBlob) {
            const file = new File([audioBlob], "recording.webm", {
                type: "audio/webm",
            });
            uploadFile(file);
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
                            Transcription
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Record voice or upload audio file
                        </p>
                    </div>
                    <Link href="/dashboard">
                        <Button variant="outline">Back to Home</Button>
                    </Link>
                </div>

                {/* Recording Controls */}
                <div className="border border-border bg-card p-8">
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
                                    className="h-16 w-16 rounded-full"
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
                                        className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
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
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        "Submit for Transcription"
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
                                        Or upload file
                                    </span>
                                </div>
                            </div>

                            <label
                                htmlFor="file-upload"
                                className="mt-4 flex cursor-pointer items-center justify-center gap-2 border border-border bg-secondary p-4 transition-colors hover:bg-secondary/80"
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
                    </div>
                </div>

                {/* Transcription Result */}
                {(transcription || isLoading) && (
                    <div className="border border-border bg-card p-8">
                        <h2 className="text-xl font-semibold mb-4 text-foreground">
                            Transcription Result
                        </h2>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="prose prose-invert max-w-none">
                                <p className="text-foreground whitespace-pre-wrap">
                                    {transcription}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
