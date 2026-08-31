import { useEffect, useState } from "react";
import useLocalState from "@/state/state";
import { Zap, MessageCircle, Activity } from "lucide-react";

export default function NostrSignals() {
    const lastNostrEventTime = useLocalState((s) => s.lastNostrEventTime);
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (lastNostrEventTime === 0) return;

        // Trigger animation
        setActive(true);
        const t = setTimeout(() => setActive(false), 1000);
        return () => clearTimeout(t);
    }, [lastNostrEventTime]);

    return (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
            <div className="relative flex items-center justify-center">
                {/* Ripple Effect */}
                {active && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75 animate-ping"></span>
                )}

                {/* Core Orb */}
                <div
                    className={`
            relative inline-flex rounded-full h-8 w-8 items-center justify-center 
            transition-all duration-300 ease-out border shadow-lg
            ${active
                            ? "bg-purple-600 border-purple-400 scale-110 shadow-purple-500/50"
                            : "bg-gray-800 border-gray-700 scale-100 opacity-50"
                        }
          `}
                >
                    {active ? (
                        <Zap size={14} className="text-white" fill="currentColor" />
                    ) : (
                        <Activity size={14} className="text-gray-400" />
                    )}
                </div>
            </div>
        </div>
    );
}
