import React, { useState } from 'react';
import { useMultiplayer } from '../context/MultiplayerContext';
import { Users, Plus, LogOut, Play, Lock, Map as MapIcon, RefreshCw, Trophy } from 'lucide-react';
import { MenuButton } from './ui/MenuButton';

interface LobbyViewProps {
    onBack: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ onBack }) => {
    const {
        isConnected,
        availableRooms,
        currentRoom,
        createRoom,
        joinRoom,
        leaveRoom,
        toggleReady,
        startGame,
        username
    } = useMultiplayer();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState(`${username}'s Game`);
    const [selectedMap, setSelectedMap] = useState('World Map');
    const [maxPlayers, setMaxPlayers] = useState(10);

    // If in a room, show the Room Lobby
    if (currentRoom) {
        const isHost = currentRoom.players.find(p => p.id === currentRoom.players[0].id)?.username === username; // Simplified host check
        // Better host check: we need socket ID or similar, but for now username is okay for unique mock

        return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full max-w-4xl bg-[#0f172a] border border-cyan-900/50 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">

                    {/* Room Header */}
                    <div className="p-6 border-b border-cyan-900/30 bg-slate-900/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-wider flex items-center gap-3">
                                <span className="text-cyan-500">ROOM:</span> {currentRoom.name}
                            </h2>
                            <div className="flex items-center gap-4 mt-2 text-slate-400 text-sm">
                                <span className="flex items-center gap-1"><MapIcon size={14} /> {currentRoom.map}</span>
                                <span className="flex items-center gap-1"><Users size={14} /> {currentRoom.players.length}/{currentRoom.maxPlayers} Players</span>
                                <span className="px-2 py-0.5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 text-xs">
                                    {currentRoom.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={leaveRoom}
                            className="p-2 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                        >
                            <LogOut size={24} />
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex overflow-hidden">

                        {/* Player List */}
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar border-r border-cyan-900/30">
                            <h3 className="text-cyan-400 font-bold mb-4 text-sm tracking-widest uppercase">Connected Commanders</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {currentRoom.players.map((player) => (
                                    <div
                                        key={player.id}
                                        className={`
                      flex items-center justify-between p-4 rounded-lg border transition-all duration-300
                      ${player.isReady
                                                ? 'bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                                                : 'bg-slate-800/50 border-slate-700'}
                    `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${player.isReady ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-slate-400'}`}>
                                                {player.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className={`font-bold ${player.isReady ? 'text-white' : 'text-slate-300'}`}>
                                                    {player.username} {player.isHost && <span className="text-xs text-yellow-500 ml-2 border border-yellow-500/30 px-1 rounded">HOST</span>}
                                                </div>
                                                <div className="text-xs text-slate-500">Rank: Private</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Ready status removed as per request */}
                                            <span className="text-slate-600 font-bold text-sm tracking-wider">CONNECTED</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chat / Map Preview (Right Side) */}
                        <div className="w-1/3 bg-slate-900/30 p-6 flex flex-col gap-6">
                            <div className="aspect-video bg-black rounded-lg border border-slate-800 relative overflow-hidden group">
                                <img src="/normal map.png" alt="Map Preview" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="bg-black/70 px-3 py-1 rounded text-xs text-white font-mono">MAP PREVIEW</span>
                                </div>
                            </div>

                            <div className="flex-1 bg-black/20 rounded-lg border border-slate-800 p-4">
                                <div className="text-slate-500 text-center text-sm italic mt-10">Chat system initializing...</div>
                            </div>
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-6 border-t border-cyan-900/30 bg-slate-900/80 flex justify-end gap-4">
                        {/* Only Host can start */}
                        {/* Only Host can start */}
                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={currentRoom.players.length < 1} // Should be < 2 for real game
                                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                START GAME
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Main Lobby Browser
    return (
        <div className="absolute inset-0 z-40 bg-[#020617] flex flex-col font-['Rajdhani']">

            {/* Top Bar */}
            <div className="h-20 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-8 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <LogOut className="rotate-180" />
                    </button>
                    <h1 className="text-2xl font-bold text-white tracking-widest flex items-center gap-2">
                        <span className="text-cyan-500">MULTIPLAYER</span> LOBBY
                    </h1>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-sm text-slate-300 font-mono">{isConnected ? 'ONLINE' : 'CONNECTING...'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-white font-bold">{username}</div>
                            <div className="text-xs text-cyan-500">Level 12 Commander</div>
                        </div>
                        <div className="w-10 h-10 bg-cyan-900/50 rounded-full border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                            <Trophy size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 flex gap-8 overflow-hidden">

                {/* Sidebar Filters */}
                <div className="w-64 flex flex-col gap-4">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <Plus size={20} /> CREATE ROOM
                    </button>

                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 flex-1">
                        <h3 className="text-slate-400 font-bold mb-4 text-sm">FILTERS</h3>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-white">
                                <input type="checkbox" className="accent-cyan-500" defaultChecked /> Hide Full Rooms
                            </label>
                            <label className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-white">
                                <input type="checkbox" className="accent-cyan-500" defaultChecked /> Hide Playing
                            </label>
                        </div>
                    </div>
                </div>

                {/* Room List */}
                <div className="flex-1 bg-slate-900/30 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            AVAILABLE OPERATIONS <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">{availableRooms.length}</span>
                        </h3>
                        <button
                            className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                            aria-label="Refresh list"
                            title="List updates automatically"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {availableRooms.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                <MapIcon size={64} className="mb-4 opacity-50" />
                                <p className="mb-2 font-medium opacity-75">No active operations found.</p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="text-sm text-cyan-500 hover:text-cyan-400 underline underline-offset-4 decoration-slate-500 hover:decoration-cyan-400 transition-all font-bold"
                                >
                                    Create a room to start a new conflict
                                </button>
                            </div>
                        ) : (
                            availableRooms.map(room => (
                                <div
                                    key={room.id}
                                    className="group bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 rounded-lg p-4 flex items-center justify-between transition-all duration-200"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-black rounded overflow-hidden relative border border-slate-600 group-hover:border-cyan-500/50 transition-colors">
                                            <img src="/normal map.png" className="w-full h-full object-cover opacity-60" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{room.name}</h4>
                                            <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                                <span className="flex items-center gap-1"><MapIcon size={12} /> {room.map}</span>
                                                <span className="flex items-center gap-1"><Users size={12} /> {room.players.length}/{room.maxPlayers}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${room.status === 'waiting' ? 'text-green-500' : 'text-yellow-500'}`}>
                                                {room.status.toUpperCase()}
                                            </div>
                                            <div className="text-xs text-slate-500">Ping: 24ms</div>
                                        </div>
                                        <button
                                            onClick={() => joinRoom(room.id)}
                                            disabled={room.status !== 'waiting' || room.players.length >= room.maxPlayers}
                                            className="px-6 py-3 bg-slate-700 hover:bg-cyan-600 text-white font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            JOIN
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-room-title"
                >
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 w-full max-w-md shadow-2xl">
                        <h2 id="create-room-title" className="text-2xl font-bold text-white mb-6">Create New Operation</h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="room-name" className="block text-sm text-slate-400 mb-1">Room Name</label>
                                <input
                                    id="room-name"
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label htmlFor="map-select" className="block text-sm text-slate-400 mb-1">Map Selection</label>
                                <select
                                    id="map-select"
                                    value={selectedMap}
                                    onChange={(e) => setSelectedMap(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 outline-none"
                                >
                                    <option>World Map</option>
                                    <option>Europe</option>
                                    <option>Fractured Lands</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="max-players" className="block text-sm text-slate-400 mb-1">Max Players: {maxPlayers}</label>
                                <input
                                    id="max-players"
                                    type="range"
                                    min="2"
                                    max="50"
                                    value={maxPlayers}
                                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                                    className="w-full accent-cyan-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded transition-colors"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={() => {
                                    createRoom(newRoomName, selectedMap, maxPlayers);
                                    setShowCreateModal(false);
                                }}
                                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded transition-colors shadow-lg shadow-cyan-900/20"
                            >
                                CREATE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
