## SmartMeetingNotes

## Opis projektu

SmartMeetingNotes to rozszerzenie przeglądarkowe do automatycznego generowania notatek z rozmów online. Integruje się z platformami do wideokonferencji, analizując treść rozmów i zapisując kluczowe informacje.
Główne funkcjonalności:

    Analiza rozmów w tle za pomocą content.js.
    Przechwytywanie i przetwarzanie tekstu w background.js.
    Interfejs użytkownika w popup.html.
    Backend w Node.js, obsługiwany w katalogu server.

## Wymagania
- **Google Chrome** (lub inna przeglądarka obsługująca WebExtensions)
- **Node.js** (zalecana wersja: LTS)
- **npm** lub **yarn** do zarządzania zależnościami

## Instalacja i uruchomienie

### 1. Pobranie projektu
Pobierz lub sklonuj repozytorium:

git clone https://github.com/Dawid0508/SmartMeetingNotes.git
cd SmartMeetingNotes

## 2. Instalacja zależności
Zainstaluj zależności backendu

cd server
npm install

## 3. Konfiguracja środowiska
Przed uruchomieniem serwera należy utworzyć dwa pliki:

    1. Plik JSON z kluczem do Google Cloud
        Utwórz plik google_cloud_key.json w katalogu server/.
        Pobierz klucz JSON z Google Cloud Console i zapisz go w tym pliku.
        Upewnij się, że plik google_cloud_key.json znajduje się w .gitignore, aby nie został udostępniony publicznie.
    
    2. .env
        W katalogu server/ utwórz plik .env i dodaj do niego następujące wartości:
            EMAIL="twój_email@gmail.com"
            EMAIL_PASSWORD="hasło_do_emaila"
            GOOGLE_APPLICATION_CREDENTIALS="google_cloud_key.json"
            GEMINI_API_KEY="twój_klucz_API_Gemini"
        
        Upewnij się, że plik .env również jest dodany do .gitignore.


## 3. Uruchomienie servera

node server.js

Serwer powinien uruchomić się na http://localhost:3000/

## 4. Instalacja rozszerzenia w Chrome
 
 - Otwórz chrome://extensions/.
 - Włącz Tryb deweloperski.
 - Kliknij Załaduj rozpakowane.
 - Wybierz katalog SmartMeetingNotes.


Autorzy: <br />
[Michał Chmiel](https://github.com/Spren3) <br />
[Mateusz Sznurawa](https://github.com/mateusznu) <br />
[Dawid Gruszecki](https://github.com/Dawid0508) <br />
