"use client";

import { X, Upload } from "lucide-react";
import { Button } from "./button";
import { useState } from "react";

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    questionText: string;
    onUpload: (file: File) => void;
}

export function UploadModal({ isOpen, onClose, questionText, onUpload }: UploadModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const handleUploadClick = () => {
        if (selectedFile) {
            onUpload(selectedFile);
            setSelectedFile(null);
            // Parent handles closing
        }
    };

    const handleSkip = () => {
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-secondary border-b border-border p-6 flex items-start justify-between">
                    <div className="flex-1 pr-4">
                        <h3 className="text-lg font-semibold text-foreground mb-2">Upload Required</h3>
                        <p className="text-sm text-muted-foreground">{questionText}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="flex-shrink-0"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Upload Area */}
                <div className="p-6">
                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                            ? "border-primary bg-primary/10"
                            : "border-border bg-secondary/30"
                            }`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />

                        {selectedFile ? (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">
                                    Drop your file here or click to browse
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Supports JPG, PNG, PDF (Max 5MB)
                                </p>
                            </div>
                        )}

                        <input
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="file-upload"
                            accept="image/*,.pdf"
                        />
                        <label htmlFor="file-upload">
                            <Button variant="outline" className="mt-4" asChild>
                                <span className="cursor-pointer">Browse Files</span>
                            </Button>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-6">
                        <Button
                            variant="outline"
                            onClick={handleSkip}
                            className="flex-1"
                        >
                            Skip
                        </Button>
                        <Button
                            onClick={handleUploadClick}
                            disabled={!selectedFile}
                            className="flex-1"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
