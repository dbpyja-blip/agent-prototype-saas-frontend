export function LoadingDots({ variant = "dark" }: { variant?: "dark" | "light" }) {
    const dotColor = variant === "dark" ? "bg-black" : "bg-white";

    return (
        <div className="flex items-center gap-1">
            <div className={`w-2 h-2 ${dotColor} rounded-full animate-bounce [animation-delay:-0.3s]`}></div>
            <div className={`w-2 h-2 ${dotColor} rounded-full animate-bounce [animation-delay:-0.15s]`}></div>
            <div className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`}></div>
        </div>
    );
}
