// src/geminiApi.js
import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI = null;
let _currentModelName = null;
let _currentModelCapabilities = [];

// Helper to determine capabilities based on model name
const getModelCapabilities = (modelName) => {
  if (modelName.includes('vision') || modelName === 'gemini-2.0-flash') {
    return ['text', 'vision'];
  }
  return ['text'];
};

// Function to initialize the Gemini API with user-provided key and model
export const initializeGemini = (apiKey, modelName) => {
  if (!apiKey) {
    console.error("API Key is required for Gemini API initialization.");
    return false;
  }
  if (!modelName) {
    console.warn("Model Name not provided, defaulting to 'gemini-2.0-flash' for initialization.");
    modelName = "gemini-2.0-flash";
  }

  _genAI = new GoogleGenerativeAI(apiKey);
  _currentModelName = modelName;
  _currentModelCapabilities = getModelCapabilities(modelName);
  console.log(`Gemini API initialized with model: ${_currentModelName}`);
  return true;
};

// Functions to get the currently configured model name and capabilities
export const getGeminiModelName = () => _currentModelName;
export const getGeminiModelCapabilities = () => _currentModelCapabilities;

// Function to start a chat session with history
export const startChatSession = (history) => { // Removed modelName from args, using internal one
  if (!_genAI || !_currentModelName) {
    throw new Error("Gemini API not initialized. Please set API key and model first.");
  }
  const model = _genAI.getGenerativeModel({ model: _currentModelName });

  const formattedHistory = history.map(msg => {
    return {
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    };
  }).filter(msg => msg.parts[0].text); // Filter out empty messages that might be from images

  return model.startChat({
    history: formattedHistory,
  });
};

// Modified: Use chat.sendMessage for text-only conversations
export const generateTextContent = async (prompt, generationConfig, chatHistory) => { // Removed modelName from args
  if (!_genAI || !_currentModelName) {
    return "Error: Gemini API not initialized. Please set API key and model first.";
  }

  const apiGenerationConfig = {
    ...generationConfig,
    candidateCount: 1,
    stopSequences: [],
  };

  const chat = startChatSession(chatHistory); // chatHistory includes the current user message
  try {
    const result = await chat.sendMessage(prompt, apiGenerationConfig);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating text content with chat API:", error);
    return "Error: Could not generate content.";
  }
};

// Modified: Continue using model.generateContent for multimodal (for robust image handling)
export const generateMultimodalContent = async (
  promptParts,
  generationConfig // Removed modelName from args
) => {
  if (!_genAI || !_currentModelName) {
    return "Error: Gemini API not initialized. Please set API key and model first.";
  }

  const apiGenerationConfig = {
    ...generationConfig,
    candidateCount: 1,
    stopSequences: [],
  };

  const model = _genAI.getGenerativeModel({ model: _currentModelName });
  try {
    const result = await model.generateContent({ contents: [{ parts: promptParts }] }, apiGenerationConfig);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating multimodal content:", error);
    return "Error: Could not generate content.";
  }
};