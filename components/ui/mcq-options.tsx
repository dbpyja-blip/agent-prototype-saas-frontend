"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface MCQOptionsProps {
    question: string;
    options: string[];
    isMultiSelect: boolean;
    onSubmit: (selectedOptions: string[]) => void;
    onSkip: () => void;
}

export function MCQOptions({
    question,
    options,
    isMultiSelect,
    onSubmit,
    onSkip,
}: MCQOptionsProps) {
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

    const handleOptionClick = (option: string) => {
        if (option.toLowerCase() === "skip") {
            onSkip();
            return;
        }

        if (isMultiSelect) {
            // Multi-select: toggle option
            setSelectedOptions((prev) =>
                prev.includes(option)
                    ? prev.filter((o) => o !== option)
                    : [...prev, option]
            );
        } else {
            // Single-select: replace selection
            setSelectedOptions([option]);
        }
    };

    const handleSubmit = () => {
        if (selectedOptions.length > 0) {
            onSubmit(selectedOptions);
            setSelectedOptions([]);
        }
    };

    const handleSkip = () => {
        onSkip();
        setSelectedOptions([]);
    };

    // Filter out "Skip" from options list (will be a button instead)
    const regularOptions = options.filter((opt) => opt.toLowerCase() !== "skip");
    const hasSkipOption = options.some((opt) => opt.toLowerCase() === "skip");

    return (
        <div className="space-y-3">
            {/* Options Grid */}
            <div className="flex flex-wrap gap-2">
                {regularOptions.map((option, index) => {
                    const isSelected = selectedOptions.includes(option);

                    return (
                        <button
                            key={index}
                            onClick={() => handleOptionClick(option)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all ${isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80"
                                }`}
                        >
                            {isMultiSelect && isSelected && (
                                <Check className="h-3.5 w-3.5" />
                            )}
                            {!isMultiSelect && (
                                <div className={`h-2 w-2 ${isSelected ? "bg-primary-foreground" : "bg-muted-foreground/30"
                                    }`} />
                            )}
                            <span>{option}</span>
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons - Skip and Submit on same line */}
            <div className="flex items-center gap-2">
                {hasSkipOption && (
                    <Button
                        variant="ghost"
                        onClick={handleSkip}
                        size="sm"
                        className="text-xs h-7"
                    >
                        Skip
                    </Button>
                )}
                <Button
                    onClick={handleSubmit}
                    disabled={selectedOptions.length === 0}
                    size="sm"
                    className="text-xs h-7"
                >
                    Submit {selectedOptions.length > 0 && `(${selectedOptions.length})`}
                </Button>

                {/* Helper Text - inline with buttons */}
                {isMultiSelect && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                        Select multiple
                    </span>
                )}
            </div>
        </div>
    );
}
