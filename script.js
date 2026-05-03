// --- 1. Configuration ---
const API_KEY = "AIzaSyD0YCA4QSALKVppWsIQBMbEqT8X6qzDdU0";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let map, currentMarker = null;

// --- 2. Game State Variables ---
let chatHistory = [];
let score = 0;
let answersEvaluated = 0; 
const MAX_QUESTIONS = 5;
let playerName = "";
let gameDifficulty = "";

// The AI Prompt 
const systemInstruction = `
You are GeoBot, an engaging geography quizmaster playing a ${MAX_QUESTIONS}-question multiple-choice game.
CRITICAL RULES:
1. THE MAP HINT: Every single time you ask a question about a location, you MUST include its GPS coordinates in this format: [MAP: latitude, longitude]. This will move the user's map to the location to give them visual context!
2. THE OPTIONS: Every time you ask a question, append 4 options at the end: [OPTIONS: Option 1 | Option 2 | Option 3 | Option 4].
3. THE EVALUATION: When the user answers, you MUST evaluate it. If they are right, start your message with [EVAL: CORRECT]. If they are wrong, start with [EVAL: WRONG]. Provide a short 1-sentence explanation of the answer.
4. GAME LIMIT: After evaluating the user's final (${MAX_QUESTIONS}th) answer, do NOT ask another question and do NOT provide options. Just congratulate them and say the game is over.
5. Make sure the questions match the user's requested difficulty level.
`;

// --- 3. Core Functions ---

function initGame() {
    playerName = document.getElementById("player-name").value.trim() || "Adarsh";
    gameDifficulty = document.getElementById("difficulty-level").value;
    
    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("app-container").style.display = "flex";

    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // Changed loading text color to match the new blue theme
    document.getElementById("options-container").innerHTML = "<p style='color:#3b82f6; font-weight:800;'>Connecting to GeoBot...</p>";
    
    sendToGemini(`Hello! My name is ${playerName}. Start the game, greet me, and give me Question 1! My difficulty is ${gameDifficulty}.`);
}

function addMessageToUI(sender, text) {
    const chatBox = document.getElementById("chat-history");
    const wrapper = document.createElement("div");
    wrapper.className = `msg-wrapper ${sender === "user" ? "wrapper-user" : "wrapper-bot"}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${sender === "user" ? "user-avatar" : ""}`;
    avatar.innerText = sender === "user" ? playerName.charAt(0).toUpperCase() : "🤖";

    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender === "user" ? "user-message" : "bot-message"}`;
    msgDiv.innerText = text;

    wrapper.appendChild(avatar);
    wrapper.appendChild(msgDiv);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function renderOptions(optionsArray) {
    const container = document.getElementById("options-container");
    container.innerHTML = ""; 

    if (optionsArray.length === 0) return; 

    optionsArray.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerText = opt;
        btn.onclick = () => submitAnswer(opt);
        container.appendChild(btn);
    });
}

function submitAnswer(selectedOption) {
    addMessageToUI("user", selectedOption);
    // Changed loading text color to match the new blue theme
    document.getElementById("options-container").innerHTML = "<p style='color:#3b82f6; font-weight:800;'>Checking answer...</p>";
    sendToGemini(selectedOption);
}

// Talk to Gemini
async function sendToGemini(text) {
    chatHistory.push({ role: "user", parts: [{ text: text }] });

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: chatHistory
            })
        });

        const data = await response.json();
        let aiText = data.candidates[0].content.parts[0].text;

        if (aiText.includes("[EVAL: CORRECT]")) {
            score++;
            answersEvaluated++;
            aiText = aiText.replace("[EVAL: CORRECT]", "✅ Correct!").trim();
        } else if (aiText.includes("[EVAL: WRONG]")) {
            answersEvaluated++;
            aiText = aiText.replace("[EVAL: WRONG]", "❌ Incorrect.").trim();
        }

        // Parse Map Coordinates 
        const mapRegex = /\[MAP:\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)\]/;
        const mapMatch = aiText.match(mapRegex);
        if (mapMatch) {
            const lat = parseFloat(mapMatch[1]);
            const lon = parseFloat(mapMatch[3]);
            map.flyTo([lat, lon], 6, { duration: 2.5 }); 
            if (currentMarker) map.removeLayer(currentMarker);
            currentMarker = L.marker([lat, lon]).addTo(map);
            aiText = aiText.replace(mapRegex, "").trim();
        }

        // Parse Multiple Choice Options
        const optionsRegex = /\[OPTIONS:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\]/;
        const optMatch = aiText.match(optionsRegex);
        let currentOptions = [];
        
        if (optMatch) {
            currentOptions = [optMatch[1].trim(), optMatch[2].trim(), optMatch[3].trim(), optMatch[4].trim()];
            aiText = aiText.replace(optionsRegex, "").trim();
        }

        addMessageToUI("bot", aiText);
        chatHistory.push({ role: "model", parts: [{ text: data.candidates[0].content.parts[0].text }] });

        document.getElementById("score").innerText = score;
        document.getElementById("q-count").innerText = Math.min(answersEvaluated + 1, MAX_QUESTIONS);

        // Game Over Logic Check
        if (answersEvaluated >= MAX_QUESTIONS) {
            document.getElementById("options-container").innerHTML = ""; 
            
            // Wait 5.5 seconds so user can read the final explanation
            setTimeout(() => {
                document.getElementById("final-score-text").innerText = `${playerName}, you scored ${score} out of ${MAX_QUESTIONS}!`;
                document.getElementById("game-over-overlay").style.display = "flex";
            }, 5500); 
        } else {
            renderOptions(currentOptions); 
        }

    } catch (error) {
        console.error(error);
        addMessageToUI("bot", "Oops! Connection error.");
    }
}
