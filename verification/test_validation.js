import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
    autoConnect: false,
    transports: ["websocket"]
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log("Starting Verification Tests...");

    socket.connect();

    await new Promise(resolve => socket.on("connect", resolve));
    console.log("Connected to server.");

    // TEST 1: Invalid Room Creation
    console.log("\n[Test 1] Attempting to create room with invalid name...");
    let roomJoined = false;
    const roomJoinedHandler = () => { roomJoined = true; };
    socket.on("room_joined", roomJoinedHandler);

    socket.emit("create_room", {
        name: "a", // Too short
        map: "World Map",
        maxPlayers: 10,
        username: "Tester"
    });

    await sleep(500);
    socket.off("room_joined", roomJoinedHandler);

    if (roomJoined) {
        console.error("FAILED: Room was created with invalid name!");
        process.exit(1);
    } else {
        console.log("PASSED: Invalid room creation rejected.");
    }

    // TEST 2: Valid Room Creation
    console.log("\n[Test 2] Creating valid room...");
    let currentRoomId = null;

    const joinPromise = new Promise(resolve => {
        socket.once("room_joined", (room) => {
            currentRoomId = room.id;
            resolve(room);
        });
    });

    socket.emit("create_room", {
        name: "Valid Room",
        map: "World Map",
        maxPlayers: 10,
        username: "Tester"
    });

    const room = await joinPromise;
    console.log("PASSED: Room created. ID:", room.id);

    // TEST 3: Start Game
    console.log("\n[Test 3] Starting game...");
    const startPromise = new Promise(resolve => {
        socket.once("game_started", resolve);
    });

    socket.emit("start_game", { roomId: currentRoomId });
    await startPromise;
    console.log("PASSED: Game started.");

    // TEST 4: Spawn Selection
    console.log("\n[Test 4] Selecting spawn...");
    // Wait for a game update to confirm we are in
    const spawnPromise = new Promise(resolve => {
        const handler = (data) => {
            const player = data.players.find(p => p.id === socket.id);
            if (player && player.spawnPoint !== null) {
                socket.off("game_update", handler);
                resolve(player);
            }
        };
        socket.on("game_update", handler);
    });

    // Need to trigger a game update or wait for tick
    socket.emit("game_action", {
        roomId: currentRoomId,
        action: "choose_spawn",
        data: { index: 100 }
    });

    const playerState = await spawnPromise;
    console.log("PASSED: Spawn selected. Troops:", playerState.troops);

    // TEST 5: Exploit Attempt (Negative Cost)
    console.log("\n[Test 5] Attempting expansion exploit (negative cost)...");
    const initialTroops = playerState.troops;

    // Attempt to gain 1000 troops by "spending" -1000
    socket.emit("game_action", {
        roomId: currentRoomId,
        action: "expand",
        data: {
            amount: 10,
            cost: -1000
        }
    });

    await sleep(1000); // Wait for potential update

    // Check troops again
    let finalTroops = 0;
    const finalStatePromise = new Promise(resolve => {
        socket.once("game_update", (data) => {
            const p = data.players.find(p => p.id === socket.id);
            resolve(p.troops);
        });
    });

    // Force wait for next update (passive)
    // Actually, game updates happen every 100ms (tick rate 10).
    // We just grab the next one.
    finalTroops = await finalStatePromise;

    console.log(`Initial Troops: ${initialTroops}, Final Troops: ${finalTroops}`);

    // Allow some natural income (1 gold/sec, maybe troops growth?)
    // Troops grow if < territory * 5. 100px * 0.05 = 5 troops/sec.
    // So in 1 sec, expected gain is small (~5-10).
    // If exploit worked, it would be +1000.

    if (finalTroops > initialTroops + 50) {
        console.error("FAILED: Exploit successful! Troops increased significantly.");
        process.exit(1);
    } else {
        console.log("PASSED: Exploit failed. Troops within normal range.");
    }

    console.log("\nAll tests passed successfully.");
    socket.disconnect();
    process.exit(0);
}

runTests().catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});
