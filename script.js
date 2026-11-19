
// =====================================
// OCTO MATH BATTLE
// MULTIPLAYER ENGINE
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getDatabase,
    ref,
    onValue,
    get,
    update,
    remove,
    runTransaction,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-database.js";


// =====================================
// FIREBASE CONFIGURATION
// =====================================

const firebaseConfig = {
    apiKey: "AIzaSyCpdDP4BmdLf40OcvMYYkyigRvhqce9uCE",
    authDomain: "octo-math-battle.firebaseapp.com",
    databaseURL: "https://octo-math-battle-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "octo-math-battle",
    storageBucket: "octo-math-battle.firebasestorage.app",
    messagingSenderId: "824777617547",
    appId: "1:824777617547:web:edde6befab7d2083d5a48e"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


// =====================================
// GAME VARIABLES
// =====================================

let currentRoomCode = null;
let currentPlayerRole = null;
let roomUnsubscribe = null;
let leavingRoom = false;


// =====================================
// HTML ELEMENTS
// =====================================

const playerNameInput =
    document.getElementById("playerName");

const createRoomBtn =
    document.getElementById("createRoomBtn");

const joinRoomBtn =
    document.getElementById("joinRoomBtn");

const leaderboardBtn =
    document.getElementById("leaderboardBtn");

const settingsBtn =
    document.getElementById("settingsBtn");

const roomSection =
    document.getElementById("roomSection");

const roomCodeInput =
    document.getElementById("roomCode");

const confirmJoinBtn =
    document.getElementById("confirmJoinBtn");

const mainMenu =
    document.getElementById("mainMenu");

const waitingRoom =
    document.getElementById("waitingRoom");

const displayRoomCode =
    document.getElementById("displayRoomCode");

const hostName =
    document.getElementById("hostName");

const guestName =
    document.getElementById("guestName");

const roomStatus =
    document.getElementById("roomStatus");

const copyRoomBtn =
    document.getElementById("copyRoomBtn");

const leaveRoomBtn =
    document.getElementById("leaveRoomBtn");


// =====================================
// FIREBASE CONNECTION STATUS
// =====================================

const statusBox = document.createElement("div");

statusBox.id = "firebaseStatus";

statusBox.textContent = "MEMERIKSA KONEKSI...";

statusBox.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
    padding: 10px 15px;
    background: #333;
    color: white;
    border-radius: 10px;
    font-size: 12px;
`;

document.body.appendChild(statusBox);

const connectionRef = ref(database, ".info/connected");

onValue(connectionRef, (snapshot) => {

    if (snapshot.val() === true) {

        statusBox.textContent = "🟢 FIREBASE ONLINE";

    } else {

        statusBox.textContent = "🔴 FIREBASE OFFLINE";

    }

});


// =====================================
// PLAYER NAME
// =====================================

function getPlayerName() {

    const name = playerNameInput.value.trim();

    if (!name) {

        alert("Masukkan nama pemain terlebih dahulu!");

        playerNameInput.focus();

        return null;

    }

    return name;

}


// =====================================
// SHOW WAITING ROOM
// =====================================

function showWaitingRoom(code) {

    mainMenu.classList.add("hidden");

    waitingRoom.classList.remove("hidden");

    displayRoomCode.textContent = code;

}


// =====================================
// RETURN TO MAIN MENU
// =====================================

function returnToMenu(message) {

    if (roomUnsubscribe) {

        roomUnsubscribe();

        roomUnsubscribe = null;

    }

    currentRoomCode = null;

    currentPlayerRole = null;

    waitingRoom.classList.add("hidden");

    mainMenu.classList.remove("hidden");

    roomSection.classList.add("hidden");

    if (message) {

        alert(message);

    }

}


// =====================================
// GENERATE ROOM CODE
// =====================================

function generateRoomCode() {

    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();

}


// =====================================
// CREATE ROOM
// =====================================

createRoomBtn.addEventListener("click", async () => {

    const player = getPlayerName();

    if (!player) return;

    if (currentRoomCode) return;

    createRoomBtn.disabled = true;

    try {

        let roomCode = null;
        let roomRef = null;

        // Mencoba membuat kode room unik

        for (let i = 0; i < 5; i++) {

            const code = generateRoomCode();

            const newRoomRef = ref(
                database,
                "rooms/" + code
            );

            const result = await runTransaction(
                newRoomRef,
                (currentRoom) => {

                    if (currentRoom !== null) {

                        return;

                    }

                    return {

                        host: player,

                        players: {

                            host: {
                                name: player
                            }

                        },

                        status: "waiting",

                        createdAt: Date.now()

                    };

                }
            );

            if (result.committed) {

                roomCode = code;

                roomRef = newRoomRef;

                break;

            }

        }

        if (!roomCode) {

            throw new Error(
                "Tidak berhasil mendapatkan kode room unik."
            );

        }

        currentRoomCode = roomCode;

        currentPlayerRole = "host";

        leavingRoom = false;

        await onDisconnect(roomRef).remove();

        listenToRoom(roomCode);

        showWaitingRoom(roomCode);

    } catch (error) {

        console.error(error);

        alert(
            "Gagal membuat room: " + error.message
        );

    } finally {

        createRoomBtn.disabled = false;

    }

});


// =====================================
// JOIN ROOM MENU
// =====================================

joinRoomBtn.addEventListener("click", () => {

    if (!getPlayerName()) return;

    roomSection.classList.remove("hidden");

    roomCodeInput.focus();

});


// =====================================
// CONFIRM JOIN ROOM
// =====================================

confirmJoinBtn.addEventListener("click", async () => {

    const player = getPlayerName();

    if (!player) return;

    const code = roomCodeInput.value.trim();

    if (!/^\d{6}$/.test(code)) {

        alert("Kode room harus terdiri dari 6 angka!");

        return;

    }

    confirmJoinBtn.disabled = true;

    const roomRef = ref(
        database,
        "rooms/" + code
    );

    try {

        const result = await runTransaction(
            roomRef,
            (currentRoom) => {

                if (!currentRoom) {

                    return;

                }

                if (
                    currentRoom.status !== "waiting" ||
                    currentRoom.players?.guest
                ) {

                    return;

                }

                currentRoom.players.guest = {
                    name: player
                };

                currentRoom.status = "ready";

                return currentRoom;

            }
        );

        if (!result.committed) {

            const snapshot = await get(roomRef);

            if (!snapshot.exists()) {

                alert("Room tidak ditemukan!");

            } else {

                alert("Room sudah penuh atau pertandingan sudah dimulai!");

            }

            return;

        }

        currentRoomCode = code;

        currentPlayerRole = "guest";

        leavingRoom = false;

        const guestRef = ref(
            database,
            "rooms/" + code + "/players/guest"
        );

        await onDisconnect(guestRef).remove();

        listenToRoom(code);

        showWaitingRoom(code);

    } catch (error) {

        console.error(error);

        alert(
            "Gagal bergabung: " + error.message
        );

    } finally {

        confirmJoinBtn.disabled = false;

    }

});


// =====================================
// REALTIME ROOM LISTENER
// =====================================

function listenToRoom(code) {

    if (roomUnsubscribe) {

        roomUnsubscribe();

    }

    const roomRef = ref(
        database,
        "rooms/" + code
    );

    roomUnsubscribe = onValue(
        roomRef,
        (snapshot) => {

            if (!snapshot.exists()) {

                if (!leavingRoom) {

                    returnToMenu(
                        "Room sudah ditutup oleh host."
                    );

                }

                return;

            }

            const room = snapshot.val();

            const host = room.players?.host;

            const guest = room.players?.guest;

            hostName.textContent =
                host?.name || room.host || "Menunggu...";

            guestName.textContent =
                guest?.name || "Menunggu pemain...";

            if (guest) {

                roomStatus.textContent =
                    "🟢 KEDUA PEMAIN SUDAH TERHUBUNG!";

            } else {

                roomStatus.textContent =
                    "⏳ MENUNGGU PEMAIN KEDUA...";

            }

        },
        (error) => {

            console.error(error);

            roomStatus.textContent =
                "Gagal membaca data room.";

        }
    );

}


// =====================================
// COPY ROOM CODE
// =====================================

copyRoomBtn.addEventListener("click", async () => {

    if (!currentRoomCode) return;

    try {

        await navigator.clipboard.writeText(
            currentRoomCode
        );

        alert("Kode room berhasil disalin!");

    } catch (error) {

        prompt(
            "Salin kode room berikut:",
            currentRoomCode
        );

    }

});


// =====================================
// LEAVE ROOM
// =====================================

leaveRoomBtn.addEventListener("click", async () => {

    if (!currentRoomCode) return;

    const confirmLeave = confirm(
        "Apakah kamu yakin ingin keluar dari room?"
    );

    if (!confirmLeave) return;

    const code = currentRoomCode;

    const role = currentPlayerRole;

    const roomRef = ref(
        database,
        "rooms/" + code
    );

    leavingRoom = true;

    if (roomUnsubscribe) {

        roomUnsubscribe();

        roomUnsubscribe = null;

    }

    try {

        if (role === "host") {

            await onDisconnect(roomRef).cancel();

            await remove(roomRef);

        } else {

            const guestRef = ref(
                database,
                "rooms/" + code + "/players/guest"
            );

            await onDisconnect(guestRef).cancel();

            await update(roomRef, {

                "players/guest": null,

                status: "waiting"

            });

        }

        returnToMenu();

    } catch (error) {

        console.error(error);

        leavingRoom = false;

        listenToRoom(code);

        alert(
            "Gagal keluar dari room: " + error.message
        );

    }

});


// =====================================
// LEADERBOARD
// =====================================

leaderboardBtn.addEventListener("click", () => {

    alert(
        "LEADERBOARD\n\nFitur peringkat segera hadir!"
    );

});


// =====================================
// SETTINGS
// =====================================

settingsBtn.addEventListener("click", () => {

    alert(
        "SETTINGS\n\nPengaturan permainan segera hadir!"
    );

});


// =====================================
// INITIALIZATION
// =====================================

console.log(
    "OCTO MATH BATTLE MULTIPLAYER ENGINE LOADED!"
);
