"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TreatmentPlan {
    plan_name: string;
    details: {
        // Support both formats
        service?: {
            service_onboarding_id?: string;
            service_name?: string;
            grafts?: number;
            method?: string;
            verified?: boolean;
            [key: string]: any;
        };
        hair_transplant?: {
            grafts?: number;
            method?: string;
            verified?: boolean;
            [key: string]: any;
        };
        medications?: Array<{
            name?: string;
            product_name?: string;
            dosage?: string;
            product_id?: string | null;
            verified?: boolean;
            frequency?: string;
            duration?: string;
            route?: string;
            instruction?: string;
            [key: string]: any;
        }>;
        lab_tests?: Array<{
            name?: string;
            test_name?: string;
            diagnosis_id?: string | null;
            price?: number | string;
            verified?: boolean;
            [key: string]: any;
        }>;
        clinical_notes?: string;
        [key: string]: any;
    };
}

interface TreatmentPlanCardProps {
    plans: TreatmentPlan[];
}

export function TreatmentPlanCard({ plans }: TreatmentPlanCardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [editedPlans, setEditedPlans] = useState<TreatmentPlan[]>(
        JSON.parse(JSON.stringify(plans))
    );

    if (!plans || plans.length === 0) {
        return null;
    }

    const currentPlan = editedPlans[currentIndex];

    // Support both formats: service or hair_transplant
    const serviceData = currentPlan.details.service || currentPlan.details.hair_transplant;
    // Grafts and method can live at top-level details OR inside service
    const graftsValue = currentPlan.details.grafts ?? serviceData?.grafts;
    const methodValue = currentPlan.details.method ?? serviceData?.method ?? currentPlan.details.service?.method;
    // Safely access arrays, defaulting to empty if undefined
    const medications = currentPlan.details.medications || [];
    const lab_tests = currentPlan.details.lab_tests || [];
    const clinical_notes = currentPlan.details.clinical_notes;

    const hasNext = currentIndex < plans.length - 1;
    const hasPrev = currentIndex > 0;

    const updateService = (field: string, value: any) => {
        setEditedPlans((prev) => {
            const updated = [...prev];
            // Update whichever format is being used
            if (updated[currentIndex].details.service) {
                updated[currentIndex].details.service![field] = value;
            } else {
                if (!updated[currentIndex].details.hair_transplant) {
                    updated[currentIndex].details.hair_transplant = {};
                }
                updated[currentIndex].details.hair_transplant![field] = value;
            }
            return updated;
        });
    };

    // Update top-level details fields (grafts, method)
    const updateDetails = (field: string, value: any) => {
        setEditedPlans((prev) => {
            const updated = [...prev];
            updated[currentIndex].details[field] = value;
            return updated;
        });
    };

    const updateMedication = (index: number, field: string, value: any) => {
        setEditedPlans((prev) => {
            const updated = [...prev];
            if (updated[currentIndex].details.medications) {
                updated[currentIndex].details.medications[index][field] = value;
            }
            return updated;
        });
    };

    const updateLabTest = (index: number, field: string, value: any) => {
        setEditedPlans((prev) => {
            const updated = [...prev];
            if (updated[currentIndex].details.lab_tests) {
                updated[currentIndex].details.lab_tests[index][field] = value;
            }
            return updated;
        });
    };

    const isFieldVisible = (value: any) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.toLowerCase().startsWith('enter ')) return false;
        return true;
    };

    const activateField = (index: number, field: string) => {
        updateMedication(index, field, "");
    };

    return (
        <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-lg">
            {/* Header */}
            <div className="p-6 bg-secondary border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-foreground">
                            {currentPlan.plan_name || `Plan ${currentIndex + 1}`}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {currentIndex + 1} of {plans.length} • Edit details as needed
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentIndex(currentIndex - 1)}
                            disabled={!hasPrev}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentIndex(currentIndex + 1)}
                            disabled={!hasNext}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Clinical Notes */}
            {clinical_notes && (
                <div className="p-6 border-b border-border bg-secondary/30">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        Clinical Notes
                    </h4>
                    <div className="p-4 bg-card border border-border rounded-lg text-sm text-foreground/90 whitespace-pre-wrap">
                        {clinical_notes}
                    </div>
                </div>
            )}

            {/* Service/Hair Transplant */}
            {serviceData && (
                <div className="p-6 border-b border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-4">
                        Services (1)
                    </h4>
                    <div className="p-5 bg-secondary/50 border border-border rounded-xl">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="text-base font-semibold text-foreground mb-1">
                                    {serviceData.service_title || serviceData.service_name || "Service"} {serviceData.method ? `- ${serviceData.method}` : ""}
                                </div>
                            </div>
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${serviceData.verified
                                    ? "bg-green-500/20 text-green-600 border border-green-500/30"
                                    : "bg-red-500/20 text-red-600 border border-red-500/30"
                                    }`}
                            >
                                {serviceData.verified ? "✓ In Stock" : "✗ Out of Stock"}
                            </span>
                        </div>
                        {/* Only show grafts/method if they actually exist in the plan data */}
                        {(graftsValue !== undefined && graftsValue !== null) || (methodValue !== undefined && methodValue !== null) ? (
                            <div className="grid grid-cols-2 gap-3">
                                {(graftsValue !== undefined && graftsValue !== null) && (
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-muted-foreground">Grafts</span>
                                        <input
                                            type="number"
                                            value={graftsValue}
                                            onChange={(e) => updateDetails("grafts", parseInt(e.target.value))}
                                            className="px-3 py-2 border border-input bg-background rounded-lg text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </label>
                                )}
                                {(methodValue !== undefined && methodValue !== null) && (
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-muted-foreground">Method</span>
                                        <input
                                            type="text"
                                            value={methodValue}
                                            onChange={(e) => updateDetails("method", e.target.value)}
                                            className="px-3 py-2 border border-input bg-background rounded-lg text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </label>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Medications */}
            {medications && medications.length > 0 && (
                <div className="p-6 border-b border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-4">
                        Medications ({medications.length})
                    </h4>
                    <div className="grid gap-3">
                        {medications.map((med, idx) => {
                            // Normalize fields from backend (item_label vs name vs product_name)
                            const medName = med.item_label || med.product_name || med.name || "Medication";
                            const fields = ["dosage", "frequency", "duration", "route"];
                            const visibleFields = fields.filter(field => isFieldVisible((med as any)[field]));
                            const hiddenFields = fields.filter(field => !isFieldVisible((med as any)[field]));

                            return (
                                <div key={idx} className="p-5 bg-secondary/50 border border-border rounded-xl relative group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="text-base font-semibold text-foreground">
                                            {medName}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hiddenFields.length > 0 && (
                                                <div className="flex gap-1">
                                                    {hiddenFields.map(field => (
                                                        <Button
                                                            key={field}
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => activateField(idx, field)}
                                                            className="h-6 px-2 text-[10px] uppercase font-bold text-primary border border-primary/20 hover:bg-primary/10"
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" />
                                                            {field}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-semibold ${med.verified
                                                    ? "bg-green-500/20 text-green-600 border border-green-500/30"
                                                    : "bg-red-500/20 text-red-600 border border-red-500/30"
                                                    }`}
                                            >
                                                {med.verified ? "✓ In Stock" : "✗ Out of Stock"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {fields.map((field) => {
                                            if (!isFieldVisible((med as any)[field])) return null;

                                            return (
                                                <label key={field} className="flex flex-col gap-1.5 relative group/field">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-medium text-muted-foreground capitalize">
                                                            {field}
                                                        </span>
                                                        <button
                                                            onClick={() => updateMedication(idx, field, `Enter ${field}`)}
                                                            className="opacity-0 group-hover/field:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={(med as any)[field] || ""}
                                                        onChange={(e) => updateMedication(idx, field, e.target.value)}
                                                        placeholder={`Enter ${field}`}
                                                        className="px-3 py-2 border border-input bg-background rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>

                                    {visibleFields.length === 0 && (
                                        <div className="text-xs text-muted-foreground italic text-center py-2">
                                            No details added. Use buttons above to add dosage, frequency, etc.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Lab Tests */}
            {lab_tests && lab_tests.length > 0 && (
                <div className="p-6">
                    <h4 className="text-sm font-semibold text-foreground mb-4">
                        Lab Tests ({lab_tests.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {lab_tests.map((lab, idx) => (
                            <div key={idx} className="p-4 bg-secondary/50 border border-border rounded-xl">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={lab.examination_name || lab.name || lab.test_name || ""}
                                        onChange={(e) => updateLabTest(idx, lab.examination_name ? "examination_name" : (lab.name !== undefined ? "name" : "test_name"), e.target.value)}
                                        placeholder="Test name"
                                        className="flex-1 px-2 py-1.5 border border-input bg-background rounded-md text-sm font-semibold text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-semibold ${lab.verified
                                            ? "bg-green-500/20 text-green-600 border border-green-500/30"
                                            : "bg-red-500/20 text-red-600 border border-red-500/30"
                                            }`}
                                    >
                                        {lab.verified ? "✓" : "✗"}
                                    </span>
                                </div>
                                {lab.price !== null && lab.price !== undefined && (
                                    <div className="px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-xs font-semibold text-foreground">
                                        ₹{typeof (lab.test_cost || lab.price) === "number" ? (lab.test_cost || lab.price).toFixed(2) : (lab.test_cost || lab.price)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
