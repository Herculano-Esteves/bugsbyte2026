<div align="center">
  <img src="frontend/flight-companion/assets/Icons/MainDark.png" alt="Flight Companion Logo" width="120" style="border-radius: 20px;"/>
  <h1>Flight Companion: BugsByte 2026</h1>
  <p><strong>The travel sidekick for your entire journey — from your doorstep to your destination.</strong></p>

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Expo](https://img.shields.io/badge/Frontend-Expo-000020?logo=expo&logoColor=white)](https://expo.dev/)
  [![React Native](https://img.shields.io/badge/Mobile-React_Native-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
  [![Python](https://img.shields.io/badge/Language-Python_3.9+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
  [![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
  ![Go](https://img.shields.io/badge/go-1.18%2B-000020.svg?style=flat-square&logo=go&logoColor=white)
</div>

**Flight Companion** is a mobile application developed in 48 hours for the BugsByte 2026 Hackathon. It assists travelers by consolidating flight tracking and trip planning into a single interface.

## Overview

We built this project to solve common travel frustrations. **Flight Companion** parses boarding passes to track flights, offers a chatbot for travel questions, and provides destination guides. It demonstrates how modern tools can be combined to create a helpful travel assistant.

## Screenshots

<p align="center">
  <img src="images_project/homePage.jpg" alt="Home Screen" width="200" style="border-radius: 10px; margin: 10px;" />
  <img src="images_project/flight.jpg" alt="Flight Tracking" width="200" style="border-radius: 10px; margin: 10px;" />
  <img src="images_project/planer.jpg" alt="AI Assistant" width="200" style="border-radius: 10px; margin: 10px;" />
</p>

## Video Showcase

<p align="center">
  <a href="https://www.youtube.com/watch?v=pTjHLOc0qTQ">
    <img src="https://img.youtube.com/vi/pTjHLOc0qTQ/maxresdefault.jpg" alt="Watch Flight Companion Demo" width="600" style="border-radius: 10px;" />
  </a>
  <br>
  <a href="https://www.youtube.com/watch?v=pTjHLOc0qTQ">View on YouTube</a>
</p>


## Key Features

### Ticket Scanning
- **Barcode Scan:** Scans boarding passes to automatically import flight details.

### Travel Assistant (Chatbot)
- **Interactive Chat:** Helps answer questions about your trip.
- **Context-Aware:** Uses your itinerary to provide relevant answers.

### Trip Planner
- **City Guides:** Simple itineraries for destinations like Porto.
- **Transport:** Routes to hotels or points of interest.


## Tech Stack

The project was built using:

### **Frontend (Mobile App)**
- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Language:** TypeScript
- **Storage:** Async Storage for offline persistence
- **Maps:** Native Maps integration

### **Backend (API & Logic)**
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Data Processing:** Pandas, NumPy
- **Web Scraping:** BeautifulSoup4 (for retrieving real-time airport/flight data)
- **Scraper:** Go
- **Database:** SQLite
- **Testing:** Pytest

## Future Roadmap

- [ ] **Extended API Support**: Improve data reliability with official flight APIs.
- [ ] **Sharing**: Add ability to share trips with friends.
- [ ] **Language Support**: Add more languages.

## The Team

Flight Companion was created by:

| Member | Institution | Role / Study Area |
| :--- | :--- | :--- |
| **[Herculano Esteves](https://github.com/Herculano-Esteves)** | Universidade do Minho | Software Engineering (Team Lead) |
| **[Pergih](https://github.com/Pergih)** | Universidade do Minho | Computer Science |
| **[Arqueiro Magico](https://github.com/Arqueiro-Magico)** | Nortavia Transportes Aéreos S.A. | ATPL(A) Pilot Student (Domain Expert) |
| **[PatoST](https://github.com/PatoST)** | IPCA | Design & Engineering |

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
- **Node.js** & **npm**
- **Python 3.9+**
- **Go 1.18+**
- **Expo Go** app on your mobile device (optional, for testing)

### 1. Clone the Repository
```bash
git clone https://github.com/Herculano-Esteves/bugsbyte2026.git
cd bugsbyte2026
```

### 2. Backend Setup
The backend handles data parsing, storage, and API requests.

```bash
cd backend

# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
# On Linux/MacOS:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*Note: The server will be accessible at `http://<YOUR_LOCAL_IP>:8000`.*

### 3. Go Scraper Setup
This microservice handles barcode and PKPass file parsing.

```bash
cd backend/"Flight info get"

# Run the server
go run main.go
```
*Note: This service runs on port 8080.*

### 4. Frontend Setup
The mobile application interface.

```bash
cd frontend/flight-companion

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```
Scan the QR code with the **Expo Go** app (Android/iOS) to run the app on your phone, or press `a` to run on an Android Emulator.

## License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.