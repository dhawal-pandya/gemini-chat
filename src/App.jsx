// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  generateTextContent,
  generateMultimodalContent,
  initializeGemini, // New import
  getGeminiModelName, // New import
  getGeminiModelCapabilities // New import
} from "./geminiApi";
import ReactMarkdown from "react-markdown";

// Helper to generate a unique ID for new chats
const generateChatId = () => `chat-${Date.now()}`;

function App() {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [useMultimodal, setUseMultimodal] = useState(false);
  const [isRenamingChat, setIsRenamingChat] = useState(null);
  const fileInputRef = useRef(null);

  // State for API Key and Model Name
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelNameInput, setModelNameInput] = useState("gemini-2.0-flash"); // Default for setup screen
  const [showSetupScreen, setShowSetupScreen] = useState(true); // Initially show setup

  // State to hold the actual configured model name and capabilities
  const [configuredModelName, setConfiguredModelName] = useState(null);
  const [configuredModelCapabilities, setConfiguredModelCapabilities] = useState([]);

  // Initialize conversations and activeChatId directly
  const [conversations, setConversations] = useState({});
  const [activeChatId, setActiveChatId] = useState(null);

  // --- Initial setup check and API initialization ---
  useEffect(() => {
    const savedApiKey = localStorage.getItem("gemini_api_key");
    const savedModelName = localStorage.getItem("gemini_model_name");

    if (savedApiKey && savedModelName) {
      if (initializeGemini(savedApiKey, savedModelName)) {
        setConfiguredModelName(getGeminiModelName());
        setConfiguredModelCapabilities(getGeminiModelCapabilities());
        setShowSetupScreen(false);
      } else {
        // If initialization failed, perhaps due to invalid key, show setup again
        setShowSetupScreen(true);
      }
    } else {
      setShowSetupScreen(true);
    }
  }, []); // Run only once on mount

  // Load conversations only after setup is complete and model is configured
  useEffect(() => {
    if (!showSetupScreen && configuredModelName) {
      const savedConversations = localStorage.getItem("gemini_conversations");
      if (savedConversations) {
        const parsedConversations = JSON.parse(savedConversations);
        // Ensure all existing chats use the newly configured model
        Object.values(parsedConversations).forEach(chat => {
          chat.model = configuredModelName;
          if (!chat.generationConfig) { // Ensure generationConfig exists
            chat.generationConfig = {
              candidateCount: 1,
              stopSequences: [],
              maxOutputTokens: 2048,
              temperature: 1.0,
            };
          }
        });
        if (Object.keys(parsedConversations).length > 0) {
          setConversations(parsedConversations);
          setActiveChatId(Object.keys(parsedConversations)[0]);
          return;
        }
      }

      // If no saved conversations or empty, create a new one with the configured model
      const firstChatId = generateChatId();
      setConversations({
        [firstChatId]: {
          id: firstChatId,
          name: "New Chat 1",
          history: [],
          model: configuredModelName,
          generationConfig: {
            candidateCount: 1,
            stopSequences: [],
            maxOutputTokens: 2048,
            temperature: 1.0,
          },
        },
      });
      setActiveChatId(firstChatId);
    }
  }, [showSetupScreen, configuredModelName]); // Rerun when setup is complete or model changes

  // Effect to save conversations to localStorage whenever the 'conversations' state changes
  useEffect(() => {
    localStorage.setItem("gemini_conversations", JSON.stringify(conversations));
  }, [conversations]);


  // These lines are now safe because conversations and activeChatId are initialized
  const currentConversation = conversations[activeChatId];
  const chatHistory = currentConversation ? currentConversation.history : [];

  const currentGenerationConfig = currentConversation
    ? currentConversation.generationConfig
    : { candidateCount: 1, stopSequences: [], maxOutputTokens: 2048, temperature: 1.0 };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !imageFile) return;
    if (!configuredModelName) {
      alert("API Key and Model are not configured. Please set them up first.");
      return;
    }

    setIsLoading(true);

    const userMessage = {
      sender: "user",
      content: inputText,
      image: imageFile ? URL.createObjectURL(imageFile) : null,
    };

    setConversations(prevConversations => ({
      ...prevConversations,
      [activeChatId]: {
        ...prevConversations[activeChatId],
        history: [...prevConversations[activeChatId].history, userMessage],
      },
    }));

    let geminiResponseContent = "";
    if (useMultimodal && imageFile && configuredModelCapabilities.includes("vision")) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result.split(",")[1];
        const mimeType = imageFile.type;

        const promptParts = [
          { text: inputText },
          { inlineData: { data: base64Image, mimeType: mimeType } },
        ];
        geminiResponseContent = await generateMultimodalContent(promptParts, currentGenerationConfig);
        addGeminiResponseToHistory(geminiResponseContent);
      };
      reader.readAsDataURL(imageFile);
    } else {
      const historyForApi = [...chatHistory, userMessage];
      geminiResponseContent = await generateTextContent(inputText, currentGenerationConfig, historyForApi);
      addGeminiResponseToHistory(geminiResponseContent);
    }

    setInputText("");
    setImageFile(null);
    setUseMultimodal(false);
  };

  const addGeminiResponseToHistory = (content) => {
    const geminiMessage = { sender: "gemini", content: content };
    setConversations(prevConversations => ({
      ...prevConversations,
      [activeChatId]: {
        ...prevConversations[activeChatId],
        history: [...prevConversations[activeChatId].history, geminiMessage],
      },
    }));
    setIsLoading(false);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setUseMultimodal(true);
    }
  };

  const handleNewChat = () => {
    if (!configuredModelName) {
      alert("API Key and Model are not configured. Please set them up first.");
      return;
    }
    const newChatId = generateChatId();
    const newChatName = `New Chat ${Object.keys(conversations).length + 1}`;
    setConversations(prevConversations => ({
      ...prevConversations,
      [newChatId]: {
        id: newChatId,
        name: newChatName,
        history: [],
        model: configuredModelName,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 1.0,
        },
      },
    }));
    setActiveChatId(newChatId);
    setInputText("");
    setImageFile(null);
    setUseMultimodal(false);
    setIsRenamingChat(null);
  };

  const handleSwitchChat = (chatId) => {
    setActiveChatId(chatId);
    setInputText("");
    setImageFile(null);
    setUseMultimodal(false);
    setIsRenamingChat(null);
  };

  const handleGenerationConfigChange = (field, value) => {
    setConversations(prevConversations => ({
      ...prevConversations,
      [activeChatId]: {
        ...prevConversations[activeChatId],
        generationConfig: {
          ...prevConversations[activeChatId].generationConfig,
          [field]: value,
        },
      },
    }));
  };

  const markdownComponents = {
    p: ({ node, ...props }) => <p className="mb-2 last:mb-0 text-gray-200" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-2 last:mb-0" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-2 last:mb-0" {...props} />,
    pre: ({ node, ...props }) => <pre className="bg-gray-700 p-3 rounded-md overflow-x-auto mb-4 text-sm text-gray-100" {...props} />,
    code: ({ node, ...props }) => <code className="bg-gray-600 px-1 py-0.5 rounded text-red-300 font-mono" {...props} />,
    a: ({ node, ...props }) => <a className="text-blue-400 hover:underline" {...props} />,
    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2 text-gray-100" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-3 mb-2 text-gray-100" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-2 mb-1 text-gray-100" {...props} />,
    strong: ({ node, ...props }) => <strong className="font-semibold text-gray-50" {...props} />,
    em: ({ node, ...props }) => <em className="italic text-gray-300" {...props} />,
  };

  const handleDeleteChat = (chatIdToDelete) => {
    if (Object.keys(conversations).length === 1) {
      alert("You cannot delete the last chat. Please create a new chat first if you wish to clear this one.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      setConversations(prevConversations => {
        const newConversations = { ...prevConversations };
        delete newConversations[chatIdToDelete];

        if (activeChatId === chatIdToDelete) {
          const remainingChatIds = Object.keys(newConversations);
          setActiveChatId(remainingChatIds.length > 0 ? remainingChatIds[0] : generateChatId());
        }
        return newConversations;
      });
    }
  };

  const handleRenameChat = (chatId, newName) => {
    if (newName.trim() === "") {
      alert("Chat name cannot be empty.");
      return;
    }
    setConversations(prevConversations => ({
      ...prevConversations,
      [chatId]: {
        ...prevConversations[chatId],
        name: newName.trim(),
      },
    }));
    setIsRenamingChat(null);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSetupSubmit = () => {
    if (!apiKeyInput.trim()) {
      alert("Please enter your Gemini API Key.");
      return;
    }
    if (!modelNameInput.trim()) {
      alert("Please enter a default model name (e.g., gemini-2.0-flash).");
      return;
    }

    // Attempt to initialize the API
    if (initializeGemini(apiKeyInput, modelNameInput)) {
      localStorage.setItem("gemini_api_key", apiKeyInput);
      localStorage.setItem("gemini_model_name", modelNameInput);
      setConfiguredModelName(getGeminiModelName());
      setConfiguredModelCapabilities(getGeminiModelCapabilities());
      setShowSetupScreen(false);
      // Reload conversations to ensure they pick up the new model
      // This is handled by the useEffect watching showSetupScreen and configuredModelName
    } else {
      alert("Failed to initialize Gemini API. Check your API key and model name.");
      // Optional: Clear stored keys if initialization fails
      localStorage.removeItem("gemini_api_key");
      localStorage.removeItem("gemini_model_name");
    }
  };

  if (showSetupScreen) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-200 p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-gray-100 text-center">Setup Gemini API</h2>
          <p className="mb-4 text-gray-300 text-center">
            Enter your Google Gemini API Key and preferred default model to start.
            You can get an API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
          </p>
          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-400 mb-1">Gemini API Key:</label>
            <input
              type="password" // Use type="password" for sensitive info
              id="apiKey"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your API key here"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="modelName" className="block text-sm font-medium text-gray-400 mb-1">Default Model Name:</label>
            <select
              id="modelName"
              value={modelNameInput}
              onChange={(e) => setModelNameInput(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="gemini-2.0-flash">gemini-2.0-flash (Fast and Quick)</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro (Slow but more thinking)</option>
            </select>
          </div>
          <button
            onClick={handleSetupSubmit}
            className="w-full py-3 px-4 bg-blue-700 text-white font-bold rounded-lg shadow-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-75 transition-colors duration-200 text-lg"
          >
            Save and Start Chatting
          </button>
        </div>
      </div>
    );
  }

  // Main application UI
  return (
    <div className="flex h-screen font-sans antialiased bg-gray-900 text-gray-200">
      {/* Sidebar for chat management */}
      <div className="flex flex-col w-64 bg-gray-800 border-r border-gray-700 p-4 shadow-lg text-gray-100">
        <button
          onClick={handleNewChat}
          className="w-full py-3 px-4 mb-4 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-75 transition-colors duration-200"
        >
          + New Chat
        </button>
        <div className="flex-grow overflow-y-auto pr-2 -mr-2">
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Your Chats</h3>
          {Object.values(conversations).length === 0 && (
            <p className="text-sm text-gray-400 italic">No chats yet. Start a new one!</p>
          )}
          {Object.values(conversations).map((chat) => (
            <div
              key={chat.id}
              className={`p-3 mb-2 rounded-lg cursor-pointer border transition-all duration-200 flex items-center justify-between
                ${chat.id === activeChatId
                  ? "bg-blue-800 border-blue-600 shadow-md text-blue-100"
                  : "bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-gray-500 text-gray-200"}
                whitespace-nowrap text-sm`}
            >
              {isRenamingChat === chat.id ? (
                <input
                  type="text"
                  defaultValue={chat.name}
                  onBlur={(e) => handleRenameChat(chat.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameChat(chat.id, e.target.value);
                      e.target.blur();
                    }
                  }}
                  className="bg-gray-900 text-gray-100 px-2 py-1 rounded w-full mr-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <span onClick={() => handleSwitchChat(chat.id)} className="flex-grow overflow-hidden text-ellipsis mr-2">
                  {chat.name} (<span className="text-xs text-gray-400">
                    {configuredModelName ? configuredModelName.replace('models/', '').replace('gemini-', '') : 'N/A'}
                  </span>)
                </span>
              )}
              <div className="flex-shrink-0 flex space-x-1">
                {isRenamingChat !== chat.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsRenamingChat(chat.id); }}
                    className="p-1 rounded-full hover:bg-blue-600 text-blue-200"
                    title="Rename chat"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                  className="p-1 rounded-full hover:bg-red-600 text-red-200"
                  title="Delete chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => { // Allow user to reset API key and model
            if (window.confirm("Are you sure you want to reset your API Key and Model? This will require re-entering them.")) {
              localStorage.removeItem("gemini_api_key");
              localStorage.removeItem("gemini_model_name");
              window.location.reload(); // Simplest way to re-trigger setup
            }
          }}
          className="w-full py-2 px-4 mt-4 bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition-colors duration-200"
        >
          Reset API Key/Model
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-grow p-6 bg-gray-900 overflow-hidden">
        <h1 className="text-3xl font-bold text-gray-100 mb-6 border-b pb-4 border-gray-700">
          Gemini Chat: <span className="text-blue-400">{currentConversation?.name || "Loading..."}</span>
          <span className="ml-3 text-sm font-normal text-gray-400">
            (Model: {configuredModelName ? configuredModelName.replace('models/', '').replace('gemini-', '') : 'N/A'})
          </span>
        </h1>

        {/* Generation Configuration Inputs */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-sm border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="max-output-tokens" className="block text-sm font-medium text-gray-400">Max Output Tokens</label>
                    <input
                        type="number"
                        id="max-output-tokens"
                        min="1"
                        value={currentGenerationConfig.maxOutputTokens}
                        onChange={(e) => handleGenerationConfigChange("maxOutputTokens", parseInt(e.target.value, 10))}
                        className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label htmlFor="temperature" className="block text-sm font-medium text-gray-400">Temperature (0.0 - 1.0)</label>
                    <input
                        type="number"
                        id="temperature"
                        min="0.0"
                        max="1.0"
                        step="0.1"
                        value={currentGenerationConfig.temperature}
                        onChange={(e) => handleGenerationConfigChange("temperature", parseFloat(e.target.value))}
                        className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
        </div>

        {/* Chat History Display */}
        <div className="flex-grow mb-6 border border-gray-700 rounded-xl p-4 overflow-y-auto flex flex-col-reverse bg-gray-800 shadow-none">
          {[...chatHistory].reverse().map((msg, index) => (
            <div
              key={index}
              className={`mb-4 max-w-[80%] p-3 rounded-2xl shadow-sm break-words
                ${msg.sender === "user"
                  ? "self-end bg-green-800 border border-green-700 text-gray-100"
                  : "self-start bg-gray-700 border border-gray-600 text-gray-100"
                }`}
            >
              <strong className={`font-semibold ${msg.sender === "user" ? "text-green-300" : "text-blue-300"}`}>
                {msg.sender === "user" ? "You:" : "Gemini:"}
              </strong>{" "}
              {msg.image && (
                <div className="mt-2">
                  <img src={msg.image} alt="User Upload" className="max-w-full h-auto max-h-64 rounded-lg border border-gray-600 shadow-md object-cover" />
                </div>
              )}
              <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {isLoading && (
            <div className="self-start bg-gray-700 p-3 rounded-2xl max-w-[80%] shadow-sm border border-gray-600">
              <p className="m-0 italic text-gray-400">Gemini is thinking...</p>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex flex-col p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            className="w-full min-h-[80px] p-3 mb-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-y
                       bg-gray-900 text-gray-100 placeholder-gray-400 pl-12"
            rows="3"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            ref={fileInputRef}
            className="hidden"
          />

          {configuredModelCapabilities.includes("vision") && (
            <button
              onClick={triggerFileInput}
              className="absolute bottom-1/2 left-4 transform translate-y-1/2 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200"
              title="Add image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}

          <button
            onClick={handleSendMessage}
            disabled={isLoading || (!inputText.trim() && !imageFile && !configuredModelCapabilities.includes("vision"))}
            className="w-full py-3 px-4 bg-green-700 text-white font-bold rounded-lg shadow-md hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-opacity-75 transition-colors duration-200 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>

          {imageFile && (
            <div className="mt-4 p-3 bg-yellow-900 rounded-lg border border-yellow-700 flex items-center justify-between shadow-sm">
              <div className="flex items-center">
                <p className="font-semibold text-yellow-200 mr-3">Selected Image:</p>
                <img src={URL.createObjectURL(imageFile)} alt="Preview" className="max-w-[80px] max-h-[80px] rounded-md border border-yellow-600 object-cover shadow-sm" />
                <span className="ml-3 text-yellow-300 text-sm truncate max-w-[150px]">{imageFile.name}</span>
              </div>
              <button
                onClick={() => setImageFile(null)}
                className="ml-4 py-2 px-4 bg-red-700 text-white rounded-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors duration-200 text-sm"
              >
                Remove
              </button>
            </div>
          )}
        </div>
        {/* Attribution Footer */}
        <div className="mt-6 text-center text-gray-400 text-sm">
            Made with ❤️ by {" "}
            <a
                href="https://dhawal-pandya.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
            >
                Dhawal Pandya
            </a>
        </div>
      </div>
    </div>
  );
}

export default App;