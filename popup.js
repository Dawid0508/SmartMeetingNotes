let stream; // Globalny strumień dla popup.js

document.getElementById("start-recording").addEventListener("click", () => {
    // Sprawdź, czy `getDisplayMedia` jest obsługiwane
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.error("Przeglądarka nie obsługuje getDisplayMedia.");
        alert("Twoja przeglądarka nie obsługuje funkcji nagrywania ekranu.");
        return;
    }

    navigator.mediaDevices
        .getDisplayMedia({
            audio: true,
            video: false
        })
        .then((mediaStream) => {
            stream = mediaStream; // Zapisz strumień w zmiennej
            console.log("Strumień dźwięku przechwycony:", stream);

            // Przekazanie strumienia do background.js
            chrome.runtime.sendMessage(
                { command: "start-recording" },
                (response) => {
                    if (response.success) {
                        console.log("Nagrywanie rozpoczęte.");
                        document.getElementById("status").textContent = "Nagrywanie w toku...";
                        document.getElementById("stop-recording").disabled = false;
                    } else {
                        console.error("Błąd podczas rozpoczynania nagrywania:", response.message);
                    }
                }
            );
        })
        .catch((error) => {
            console.error("Nie udało się przechwycić dźwięku:", error);
            alert("Nie udało się przechwycić dźwięku. Sprawdź uprawnienia lub ustawienia przeglądarki.");
        });
});

document.getElementById("stop-recording").addEventListener("click", () => {
    if (stream) {
        stream.getTracks().forEach((track) => track.stop()); // Zatrzymaj strumień
        stream = null; // Wyczyszczenie globalnej zmiennej
    }

    chrome.runtime.sendMessage({ command: "stop-recording" }, (response) => {
        if (response.success) {
            console.log("Nagrywanie zatrzymane.");
            document.getElementById("status").textContent = "Nagrywanie zakończone.";
            document.getElementById("stop-recording").disabled = true;
        } else {
            console.warn("Błąd podczas zatrzymywania nagrywania:", response.message);
        }
    });
});
