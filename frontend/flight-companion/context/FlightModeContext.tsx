import React, { createContext, useState, useContext, ReactNode } from 'react';

type FlightMode = 'AIR' | 'GRD';

interface FlightModeContextType {
    mode: FlightMode;
    setMode: (mode: FlightMode) => void;
}

const FlightModeContext = createContext<FlightModeContextType | undefined>(undefined);

export function FlightModeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<FlightMode>('AIR'); // Default to AIR

    return (
        <FlightModeContext.Provider value={{ mode, setMode }}>
            {children}
        </FlightModeContext.Provider>
    );
}

export function useFlightMode() {
    const context = useContext(FlightModeContext);
    if (context === undefined) {
        throw new Error('useFlightMode must be used within a FlightModeProvider');
    }
    return context;
}
