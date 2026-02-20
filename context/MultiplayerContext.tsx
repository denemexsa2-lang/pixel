import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Define types for our multiplayer state
interface Player {
    id: string;
    username: string;
    isReady: boolean;
    isHost: boolean;
    // Game specific props
    color?: string;
    troops?: number;
    gold?: number;
    territorySize?: number;
}

interface Room {
    id: string;
    name: string;
    players: Player[];
    maxPlayers: number;
    status: 'waiting' | 'playing';
    map: string;
}

interface GameState {
    players: Player[];
    attacks: any[]; // Define proper type later
    mapId: string;
    phase?: 'warmup' | 'playing';
    timeLeft?: number;
}

interface MultiplayerContextType {
    socket: Socket | null;
    isConnected: boolean;
    currentRoom: Room | null;
    availableRooms: Room[];
    gameState: GameState | null;
    username: string;
    setUsername: (name: string) => void;
    createRoom: (roomName: string, map: string, maxPlayers: number) => void;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
    toggleReady: () => void;
    startGame: () => void;
    sendGameAction: (action: string, data: any) => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(undefined);

export const useMultiplayer = () => {
    const context = useContext(MultiplayerContext);
    if (!context) {
        throw new Error('useMultiplayer must be used within a MultiplayerProvider');
    }
    return context;
};

interface MultiplayerProviderProps {
    children: ReactNode;
}

export const MultiplayerProvider: React.FC<MultiplayerProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [username, setUsername] = useState<string>(`Player_${Math.floor(Math.random() * 1000)}`);

    useEffect(() => {
        // Initialize Socket connection
        // In production, this URL should be an environment variable
console.log('Connecting to:', import.meta.env.VITE_API_URL || 'https://frontwars-server-1234.onrender.com');
        const newSocket = io(import.meta.env.VITE_API_URL || 'https://frontwars-server-1234.onrender.com', {
            autoConnect: true,
            reconnection: true,
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to multiplayer server');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from multiplayer server');
            setIsConnected(false);
        });

        // Room events
        newSocket.on('room_list_update', (rooms: Room[]) => {
            setAvailableRooms(rooms);
        });

        newSocket.on('room_joined', (room: Room) => {
            setCurrentRoom(room);
            setGameState(null); // Reset game state on new room join
        });

        newSocket.on('room_updated', (room: Room) => {
            setCurrentRoom(room);
        });

        newSocket.on('room_left', () => {
            setCurrentRoom(null);
            setGameState(null);
        });

        // Game events
        newSocket.on('game_started', (initialState: any) => {
            console.log('Game Started!', initialState);
            setGameState({
                players: initialState.players,
                attacks: [],
                mapId: initialState.mapId
            });
        });

        newSocket.on('game_update', (update: any) => {
            setGameState(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    players: update.players,
                    attacks: update.attacks,
                    phase: update.phase,
                    timeLeft: update.timeLeft
                };
            });
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const createRoom = (roomName: string, map: string, maxPlayers: number) => {
        if (socket) {
            socket.emit('create_room', { name: roomName, map, maxPlayers, username });
        }
    };

    const joinRoom = (roomId: string) => {
        if (socket) {
            socket.emit('join_room', { roomId, username });
        }
    };

    const leaveRoom = () => {
        if (socket && currentRoom) {
            socket.emit('leave_room', { roomId: currentRoom.id });
        }
    };

    const toggleReady = () => {
        if (socket && currentRoom) {
            socket.emit('toggle_ready', { roomId: currentRoom.id });
        }
    };

    const startGame = () => {
        if (socket && currentRoom) {
            socket.emit('start_game', { roomId: currentRoom.id });
        }
    };

    const sendGameAction = (action: string, data: any) => {
        if (socket && currentRoom) {
            socket.emit('game_action', { roomId: currentRoom.id, action, data });
        }
    };

    const value = {
        socket,
        isConnected,
        currentRoom,
        availableRooms,
        gameState,
        username,
        setUsername,
        createRoom,
        joinRoom,
        leaveRoom,
        toggleReady,
        startGame,
        sendGameAction
    };

    return (
        <MultiplayerContext.Provider value={value}>
            {children}
        </MultiplayerContext.Provider>
    );
};
