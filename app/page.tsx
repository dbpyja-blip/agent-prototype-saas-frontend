import Link from "next/link";
import { ArrowRight, Bot, Shield, Stethoscope, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export default function LandingPage() {
    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] bg-background">

            {/* Hero Section */}
            <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 md:py-32 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-4 backdrop-blur-sm">
                        <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                        Next-Gen Medical AI Ecosystem
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight">
                        Healthcare Reimagined with <br className="hidden md:block" />
                        <span className="text-primary bg-clip-text">Artificial Intelligence</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Seamlessly connect patient intake, consultation, diagnosis, and treatment planning into one unified, intelligent workflow.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <SignedOut>
                        <SignInButton mode="modal">
                            <Button size="lg" className="h-12 px-8 text-base rounded-full shadow-lg shadow-primary/20 transition-transform hover:scale-105">
                                Get Started
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </SignInButton>
                    </SignedOut>
                    <SignedIn>
                        <Link href="/warming-up">
                            <Button size="lg" className="h-12 px-8 text-base rounded-full shadow-lg shadow-primary/20 transition-transform hover:scale-105">
                                Go to Dashboard
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </SignedIn>
                    <Link href="#features">
                        <Button variant="outline" size="lg" className="h-12 px-8 text-base rounded-full border-primary/20 hover:bg-primary/5">
                            Learn More
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-secondary/30 border-y border-border">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-16 space-y-2">
                        <p className="text-sm font-mono text-primary tracking-widest uppercase">Powerful Capabilities</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground">Complete Clinical Workflow</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            From the first patient interaction to the final prescription, our AI agents handle the heavy lifting.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                                <Bot className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Smart Intake</h3>
                            <p className="text-sm text-muted-foreground">
                                "HealthBot" conducts structured pre-consultation interviews, collecting history and generating clinical summaries before you even see the patient.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                                <Stethoscope className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">SOAP Notes</h3>
                            <p className="text-sm text-muted-foreground">
                                Automatically transcribe consultations and generate structured SOAP notes (Subjective, Objective, Assessment, Plan) in real-time.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="h-12 w-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 text-green-600">
                                <FileText className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Treatment Planner</h3>
                            <p className="text-sm text-muted-foreground">
                                AI-assisted treatment planning that verifies services, medications, and lab tests against your database to ensure accuracy and stock availability.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                            <div className="h-12 w-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4 text-red-600">
                                <Shield className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Safety Checks</h3>
                            <p className="text-sm text-muted-foreground">
                                Instant FDA-backed analysis of prescriptions to detect drug interactions, contraindications, and safety risks.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16 space-y-2">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground">How It Works</h2>
                        <p className="text-muted-foreground">Streamlined for efficiency</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connecting Line (Desktop Only) */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-border -z-10 -translate-y-1/2"></div>

                        {/* Step 1 */}
                        <div className="bg-background border border-border p-8 rounded-2xl text-center relative">
                            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 border-4 border-background">1</div>
                            <h3 className="text-lg font-semibold mb-2">Pre-Consult</h3>
                            <p className="text-sm text-muted-foreground">Patient completes AI intake via chatbot or app.</p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-background border border-border p-8 rounded-2xl text-center relative">
                            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 border-4 border-background">2</div>
                            <h3 className="text-lg font-semibold mb-2">Consult & Plan</h3>
                            <p className="text-sm text-muted-foreground">Doctor reviews summary, consults, and AI drafts the plan.</p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-background border border-border p-8 rounded-2xl text-center relative">
                            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 border-4 border-background">3</div>
                            <h3 className="text-lg font-semibold mb-2">Analyze & Prescribe</h3>
                            <p className="text-sm text-muted-foreground">Final safety check and instant prescription generation.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <div className="py-8 text-center border-t border-border bg-secondary/20">
                <p className="text-xs font-mono text-muted-foreground tracking-widest">
                    POWERED BY DimensionLeap
                </p>
            </div>
        </div>
    );
}
