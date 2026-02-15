import React, { createContext, useState, useContext, ReactNode } from 'react';

const CABIN_CLASS_MAP: Record<string, string> = {
    'F': 'First Class',
    'A': 'First Class',
    'P': 'First Class (Premium)',
    'J': 'Business',
    'C': 'Business',
    'D': 'Business',
    'I': 'Business',
    'Z': 'Business',
    'W': 'Premium Economy',
    'E': 'Premium Economy',
    'Y': 'Economy',
    'B': 'Economy',
    'H': 'Economy',
    'K': 'Economy',
    'L': 'Economy',
    'M': 'Economy',
    'N': 'Economy',
    'Q': 'Economy',
    'S': 'Economy',
    'T': 'Economy',
    'V': 'Economy',
    'X': 'Economy',
    'G': 'Economy',
    'U': 'Economy',
    'O': 'Economy',
};

export function mapCabinClass(code: string): string {
    if (!code) return 'Unknown';
    return CABIN_CLASS_MAP[code.toUpperCase()] || `Class ${code}`;
}

export interface BoardingPassData {
    passengerName: string;
    pnr: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    seat: string;
    carrier: string;
    cabinClassCode: string;
    cabinClassName: string;
    boardingZone: string;
    departureTime: string;
    arrivalTime: string;
    departureTimezone: string;
    arrivalTimezone: string;
    airTimeMinutes: number | null;
    // FlightAware general info
    operator?: string;
    aircraftType?: string;
    flightStatus?: string;
    originName?: string;
    originGate?: string;
    originTerminal?: string;
    destinationName?: string;
    destinationGate?: string;
    destinationTerminal?: string;
    routeDistance?: string;
    scheduledDeparture?: string;
    scheduledArrival?: string;
    estimatedDeparture?: string;
    estimatedArrival?: string;
}

interface BoardingPassContextType {
    boardingPass: BoardingPassData | null;
    setBoardingPass: (data: BoardingPassData) => void;
    updateBoardingZone: (zone: string) => void;
    clearBoardingPass: () => void;
}

const BoardingPassContext = createContext<BoardingPassContextType | undefined>(undefined);

export function BoardingPassProvider({ children }: { children: ReactNode }) {
    const [boardingPass, setBoardingPassState] = useState<BoardingPassData | null>(null);

    const setBoardingPass = (data: BoardingPassData) => {
        setBoardingPassState(data);
    };

    const updateBoardingZone = (zone: string) => {
        setBoardingPassState(prev => prev ? { ...prev, boardingZone: zone } : null);
    };

    const clearBoardingPass = () => {
        setBoardingPassState(null);
    };

    return (
        <BoardingPassContext.Provider value={{
            boardingPass,
            setBoardingPass,
            updateBoardingZone,
            clearBoardingPass,
        }}>
            {children}
        </BoardingPassContext.Provider>
    );
}

export function useBoardingPass() {
    const context = useContext(BoardingPassContext);
    if (context === undefined) {
        throw new Error('useBoardingPass must be used within a BoardingPassProvider');
    }
    return context;
}
