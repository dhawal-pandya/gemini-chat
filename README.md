---
# Gemini Chat App

A simple and spartan chat application powered by the Google Gemini API, allowing you to have engaging conversations with Gemini models, including multimodal interactions with images.
---

## Features

- **Text and Multimodal Chat:** Interact with Gemini models using text, and upload images for multimodal conversations (if the selected model supports vision).
- **Persistent Conversations:** Your chat history is saved locally in your browser.
- **Configurable Gemini Model:** Easily set your Gemini API key and choose your preferred Gemini model (e.g., `gemini-2.0-flash`, `gemini-1.0-pro`).
- **Dynamic Chat Management:** Create new chats, switch between them, rename them, and delete them.
- **Generation Configuration:** Adjust parameters like `maxOutputTokens` and `temperature` for each chat.

---

## Setup

1.  **Get an API Key:** Obtain your Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```
3.  **Install Dependencies:**
    ```bash
    npm install
    ```
4.  **Run the Application:**
    ```bash
    npm run dev
    ```
    This will start the development server, usually at `http://localhost:5173/`.

---

## Usage

1.  **Initial Setup:** On your first visit, you'll be prompted to enter your Gemini API Key and select a default model.
2.  **Start Chatting:** Once configured, you can start typing your messages in the input field.
3.  **Add Images:** If your selected model supports vision, use the `+` button to upload an image with your message.
4.  **Manage Chats:** Use the sidebar to create new chats, switch between existing ones, rename them by clicking the pencil icon, or delete them with the trash can icon.
5.  **Adjust Settings:** Modify the "Generation Settings" (e.g., `Max Output Tokens`, `Temperature`) for the active chat to fine-tune Gemini's responses.

---

## Contributing

Feel free to fork the repository and submit pull requests.

---

## License

This project is open-source and available under the [MIT License](LICENSE).

---
